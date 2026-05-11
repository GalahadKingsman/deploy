import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ContractsV1, validateOrThrow, ApiEnvSchema } from '@tracked/shared';
import { ReferralWithdrawalRequestsRepository } from './referral-withdrawal-requests.repository.js';
import { CommissionsRepository } from './commissions.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { TelegramOutboundService } from '../integrations/telegram-outbound.service.js';

function normalizePan(raw: string): string {
  return raw.replace(/\D/g, '');
}

function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]!, 10);
    if (Number.isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

@Injectable()
export class ReferralWithdrawalService {
  private readonly log = new Logger(ReferralWithdrawalService.name);

  constructor(
    private readonly withdrawals: ReferralWithdrawalRequestsRepository,
    private readonly commissions: CommissionsRepository,
    private readonly users: UsersRepository,
    private readonly telegram: TelegramOutboundService,
  ) {}

  async computeReferralMoneySnapshot(userId: string): Promise<{
    grossCents: number;
    approvedPaidOutCents: number;
    netAccruedCents: number;
    hasPendingWithdrawal: boolean;
  }> {
    const code = await this.users.getOrCreateReferralCode(userId);
    const { items } = await this.commissions.list({ limit: 500, referralCode: code });
    const grossCents = (items ?? []).reduce((s, c: { amount_cents?: number }) => s + (c.amount_cents ?? 0), 0);
    const approvedPaidOutCents = await this.withdrawals.sumApprovedAmountCentsForUser(userId);
    const netAccruedCents = Math.max(0, grossCents - approvedPaidOutCents);
    const hasPendingWithdrawal = await this.withdrawals.hasPendingForUser(userId);
    return { grossCents, approvedPaidOutCents, netAccruedCents, hasPendingWithdrawal };
  }

  async createRequest(
    userId: string,
    body: ContractsV1.PostMeReferralWithdrawalRequestV1,
  ): Promise<ContractsV1.ReferralWithdrawalRequestV1> {
    const parsed = ContractsV1.PostMeReferralWithdrawalRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Validation failed', errors: parsed.error.flatten() });
    }
    const { amountCents, phone, bankName } = parsed.data;
    const pan = normalizePan(parsed.data.cardPan);
    if (!luhnValid(pan)) {
      throw new BadRequestException({ message: 'Некорректный номер карты (проверьте контрольную сумму).' });
    }

    const snap = await this.computeReferralMoneySnapshot(userId);
    if (snap.hasPendingWithdrawal) {
      throw new ConflictException('У вас уже есть заявка на вывод на рассмотрении. Дождитесь решения.');
    }
    if (amountCents > snap.netAccruedCents) {
      throw new BadRequestException(
        `Сумма не может превышать доступный баланс (${Math.floor(snap.netAccruedCents / 100)} ₽).`,
      );
    }

    let created: ContractsV1.ReferralWithdrawalRequestV1;
    try {
      created = await this.withdrawals.create({
        userId,
        amountCents,
        cardPan: pan,
        phone: phone.trim(),
        bankName: bankName.trim(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('uq_referral_withdrawal_one_pending_per_user')) {
        throw new ConflictException('У вас уже есть заявка на рассмотрении.');
      }
      throw e;
    }

    void this.notifyTelegram(userId, amountCents).catch((err) =>
      this.log.warn(`referral withdrawal telegram notify failed: ${err instanceof Error ? err.message : String(err)}`),
    );

    return created;
  }

  private async notifyTelegram(userId: string, amountCents: number): Promise<void> {
    const user = await this.users.findById(userId);
    const first = (user?.firstName ?? '').trim();
    const last = (user?.lastName ?? '').trim();
    const name = [first, last].filter(Boolean).join(' ') || 'Пользователь';
    const rub = (amountCents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const env = validateOrThrow(ApiEnvSchema, process.env);
    const base =
      (env.PUBLIC_PLATFORM_BASE_URL ?? env.PUBLIC_WEB_ORIGIN ?? 'https://edify.su').replace(/\/+$/, '') ||
      'https://edify.su';
    const adminUrl = `${base}/platform/?screen=admin-referral-withdrawals`;
    const text =
      `Новая заявка на вывод от ${name} на сумму ${rub} ₽.\n` + `${adminUrl}`;

    const chatIdRaw = (env.REFERRAL_WITHDRAWAL_NOTIFY_CHAT_ID ?? '').trim();
    if (chatIdRaw) {
      await this.telegram.sendMessageToChatId(chatIdRaw, text);
      return;
    }
    const uname = (env.REFERRAL_WITHDRAWAL_NOTIFY_USERNAME ?? 'rickonetic').trim().replace(/^@/, '');
    await this.telegram.sendMessageToChatId(`@${uname}`, text);
  }

  async listMine(userId: string): Promise<ContractsV1.ReferralWithdrawalRequestV1[]> {
    return this.withdrawals.listForUser(userId);
  }

  async listAdmin(limit: number, offset: number): Promise<ContractsV1.AdminReferralWithdrawalRowV1[]> {
    return this.withdrawals.listAdminRows({ limit, offset });
  }

  async adminSetStatus(params: {
    id: string;
    adminUserId: string;
    next: 'approved' | 'rejected';
  }): Promise<ContractsV1.AdminReferralWithdrawalRowV1> {
    const row =
      params.next === 'approved'
        ? await this.withdrawals.tryApprovePending({ id: params.id, decidedByUserId: params.adminUserId })
        : await this.withdrawals.tryRejectPending({ id: params.id, decidedByUserId: params.adminUserId });
    if (!row) {
      const existing = await this.withdrawals.findById(params.id);
      if (!existing) {
        throw new NotFoundException('Заявка не найдена');
      }
      if (existing.status !== 'pending') {
        throw new ConflictException('Заявка уже обработана');
      }
      if (params.next === 'approved') {
        throw new BadRequestException(
          'Недостаточно средств для одобрения (баланс изменился). Отклоните заявку.',
        );
      }
      throw new BadRequestException('Не удалось обновить заявку');
    }
    return row;
  }
}
