import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiEnvSchema, ContractsV1, ErrorCodes, validateOrThrow } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyRequest } from 'fastify';
import { OrdersRepository } from './orders.repository.js';
import { TinkoffAcquiringService } from './tinkoff-acquiring.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { ExpertSubscriptionsRepository } from '../subscriptions/expert-subscriptions.repository.js';
import { ExpertMembersRepository } from '../experts/expert-members.repository.js';
import { computeExpertSubscriptionCheckout } from './subscription-checkout-pricing.js';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  private readonly log = new Logger(PaymentsController.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly tinkoff: TinkoffAcquiringService,
    private readonly usersRepository: UsersRepository,
    private readonly expertSubscriptionsRepository: ExpertSubscriptionsRepository,
    private readonly expertMembersRepository: ExpertMembersRepository,
  ) {}

  @Post('checkout/expert-subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create checkout for expert platform subscription (Tinkoff)' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async createExpertSubscriptionCheckout(
    @Body() body: ContractsV1.CreateExpertSubscriptionCheckoutRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.CreateExpertSubscriptionCheckoutResponseV1> {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    if (env.PAYMENTS_ENABLED !== true) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Payments are disabled' });
    }
    const parsed = ContractsV1.CreateExpertSubscriptionCheckoutRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }

    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });

    const product = parsed.data.product;
    const billingPeriod = parsed.data.billingPeriod;

    let platformMonthly = env.PLATFORM_ENTRY_PRICE_MONTHLY_CENTS;
    const expertMonthly = env.EXPERT_PRO_PRICE_MONTHLY_CENTS;
    const legacy = env.EXPERT_SUBSCRIPTION_CHECKOUT_PRICE_CENTS;
    // Устаревшая одна переменная — только для тарифа «Начать» (platform_entry). Иначе при EXPERT_SUBSCRIPTION_CHECKOUT_PRICE_CENTS=100
    // оба checkout получали 1 ₽, хотя в запросе product=expert_pro.
    if (typeof legacy === 'number' && Number.isFinite(legacy) && legacy > 0) {
      platformMonthly = legacy;
    }

    const { amountCents, periodDays } = computeExpertSubscriptionCheckout({
      product,
      billingPeriod,
      platformEntryMonthlyCents: platformMonthly,
      expertProMonthlyCents: expertMonthly,
    });

    if (amountCents <= 0) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Некорректная сумма checkout (проверьте PLATFORM_ENTRY_PRICE_MONTHLY_CENTS / EXPERT_PRO_PRICE_MONTHLY_CENTS).',
      });
    }

    if (product === 'expert_pro' && (await this.userHasActiveExpertSubscriptionOnAnyTeam(userId))) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message:
          'У вас уже есть активная подписка эксперта. Продление и настройки автопродления — в разделе «Профиль».',
      });
    }

    const referralCode =
      typeof parsed.data.referralCode === 'string' && parsed.data.referralCode.trim()
        ? parsed.data.referralCode.trim()
        : null;

    let existing = await this.ordersRepository.findLatestCreatedExpertSubscriptionByUser({
      userId,
      checkoutProduct: product,
      billingPeriod,
    });

    if (existing) {
      const days = existing.subscriptionPeriodDays ?? 0;
      if (existing.amountCents !== amountCents || days !== periodDays) {
        await this.ordersRepository.resetCreatedExpertSubscriptionCheckoutPricing({
          orderId: existing.id,
          userId,
          amountCents,
          subscriptionPeriodDays: periodDays,
        });
        existing =
          (await this.ordersRepository.findByIdForUser({ orderId: existing.id, userId })) ?? existing;
      }
    }

    if (existing?.payUrl) {
      return { order: existing, payUrl: existing.payUrl };
    }

    if (existing) {
      return this.tryInitTinkoffAndPersist({
        userId,
        order: existing,
        description: product === 'expert_pro' ? 'EDIFY — подписка эксперта' : 'EDIFY — доступ к платформе',
        receiptEmail: parsed.data.email ?? existing.receiptEmail ?? null,
        receiptPhone: parsed.data.phone ?? existing.receiptPhone ?? null,
      });
    }

    const order = await this.ordersRepository.createExpertSubscriptionOrder({
      userId,
      expertId: null,
      amountCents,
      currency: 'RUB',
      referralCode,
      receiptEmail: parsed.data.email ?? null,
      receiptPhone: parsed.data.phone ?? null,
      checkoutProduct: product,
      billingPeriod,
      subscriptionPeriodDays: periodDays,
    });

    return this.tryInitTinkoffAndPersist({
      userId,
      order,
      description: product === 'expert_pro' ? 'EDIFY — подписка эксперта' : 'EDIFY — доступ к платформе',
      receiptEmail: parsed.data.email ?? null,
      receiptPhone: parsed.data.phone ?? null,
    });
  }

  private async userHasActiveExpertSubscriptionOnAnyTeam(userId: string): Promise<boolean> {
    const memberships = await this.expertMembersRepository.listMembershipsByUserId(userId);
    const nowMs = Date.now();
    for (const m of memberships) {
      await this.expertSubscriptionsRepository.ensureDefault(m.expertId);
      const s = await this.expertSubscriptionsRepository.findByExpertId(m.expertId);
      if (!s || s.status !== 'active') continue;
      const endMs = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).getTime() : null;
      if (endMs == null || endMs > nowMs) return true;
    }
    return false;
  }

  private async tryInitTinkoffAndPersist(params: {
    userId: string;
    order: ContractsV1.OrderV1;
    description: string;
    receiptEmail: string | null;
    receiptPhone: string | null;
  }): Promise<ContractsV1.CreateExpertSubscriptionCheckoutResponseV1> {
    if ((params.order.amountCents ?? 0) <= 0) {
      return {
        order: params.order,
        payUrl: params.order.payUrl ?? null,
        tinkoffInitError: 'Сумма заказа не задана.',
      };
    }
    if (!this.tinkoff.isConfigured()) {
      return {
        order: params.order,
        payUrl: params.order.payUrl ?? null,
        tinkoffInitError:
          'Tinkoff не настроен в окружении API: задайте непустые TINKOFF_TERMINAL_KEY и TINKOFF_PASSWORD (символ # в .env — только внутри кавычек).',
      };
    }
    try {
      const customerKey = await this.usersRepository.getOrCreateTinkoffCustomerKey(params.userId);
      const init = await this.tinkoff.initPayment({
        orderId: params.order.id,
        amountCents: params.order.amountCents,
        description: params.description,
        receiptEmail: params.receiptEmail,
        receiptPhone: params.receiptPhone,
        customerKey,
        recurrent: true,
      });
      await this.ordersRepository.updateProviderFields(params.order.id, {
        provider: 'tinkoff',
        providerPaymentId: init.paymentId,
        providerStatus: init.status,
        payUrl: init.paymentUrl,
      });
      const updated =
        (await this.ordersRepository.findByIdForUser({ orderId: params.order.id, userId: params.userId })) ??
        params.order;
      return { order: updated, payUrl: init.paymentUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`Tinkoff Init failed for order ${params.order.id}: ${msg}`);
      const refreshed =
        (await this.ordersRepository.findByIdForUser({ orderId: params.order.id, userId: params.userId })) ??
        params.order;
      return {
        order: refreshed,
        payUrl: null,
        tinkoffInitError: PaymentsController.clampCheckoutDiagnosticMessage(msg),
      };
    }
  }

  private static clampCheckoutDiagnosticMessage(raw: string): string {
    const s = raw.replace(/\s+/g, ' ').trim();
    if (!s) return 'Init Tinkoff отклонён (пустое сообщение). Смотрите логи API.';
    return s.length > 400 ? `${s.slice(0, 397)}...` : s;
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my order by id' })
  @ApiResponse({ status: 200, description: 'Order' })
  async getMyOrder(
    @Param('orderId') orderId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{ order: ContractsV1.OrderV1 }> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const order = await this.ordersRepository.findByIdForUser({ orderId, userId });
    if (!order) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Order not found' });
    return { order };
  }

  @Get('me/orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my orders (subscription payments)' })
  @ApiResponse({ status: 200, description: 'Orders list' })
  async listMyOrders(
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.MeOrdersResponseV1> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const items = await this.ordersRepository.listByUser({ userId, limit: 100 });
    return { items };
  }
}
