import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Request,
  UnauthorizedException,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { UsersRepository } from '../../users/users.repository.js';
import { CommissionsRepository } from '../../payments/commissions.repository.js';
import { EnrollmentsRepository } from '../../student/student_enrollments.repository.js';
import { OrdersRepository } from '../../payments/orders.repository.js';
import { PayoutRequestsRepository } from '../../payments/payout-requests.repository.js';
import { S3StorageService } from '../../storage/s3-storage.service.js';
import { SubmissionsRepository } from '../../submissions/submissions.repository.js';
import { TelegramAvatarSyncService } from '../../auth/telegram/telegram-avatar-sync.service.js';
import { ErrorCodes } from '@tracked/shared';
import { validateTelegramInitData, TelegramInitDataValidationError } from '../../auth/telegram/telegram-init-data.js';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';

const env = validateOrThrow(ApiEnvSchema, process.env);

@ApiTags('User')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeController {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly commissionsRepository: CommissionsRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly payoutRequestsRepository: PayoutRequestsRepository,
    private readonly storage: S3StorageService,
    private readonly submissionsRepository: SubmissionsRepository,
    private readonly telegramAvatarSync: TelegramAvatarSyncService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({
    status: 200,
    description: 'Current user data',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          description: 'User data',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'User is banned (USER_BANNED)',
  })
  async getMe(
    @Request()
    request: {
      user?: { userId: string; telegramUserId: string };
    },
  ): Promise<ContractsV1.GetMeResponseV1> {
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException({
        message: 'User not found in request',
        error: 'Unauthorized',
      });
    }

    // Update streak on "visit" (UTC day)
    const user = await this.usersRepository.bumpStreakOnVisit(userId);

    // Best-effort: sync avatar from Telegram once per 24h if current avatar points to Telegram CDN
    try {
      const meta = await this.usersRepository.getAvatarSyncMeta(userId);
      const tgId = (meta.telegramUserId ?? '').trim();
      const rawAvatar = (meta.avatarUrl ?? '').trim();
      const last = meta.avatarSyncedAt ? new Date(meta.avatarSyncedAt).getTime() : 0;
      const stale = !last || Date.now() - last > 24 * 60 * 60 * 1000;
      const looksLikeTelegramCdn = /^https?:\/\/t\.me\/i\/userpic\//i.test(rawAvatar);
      if (stale && tgId && looksLikeTelegramCdn) {
        const up = await this.telegramAvatarSync.syncAvatarToS3({ telegramUserId: tgId, userId });
        if (up?.key) {
          const publicPath = `/public/avatar?key=${encodeURIComponent(up.key)}`;
          await this.usersRepository.updateAvatarUrl(userId, publicPath);
          await this.usersRepository.touchAvatarSyncedAt(userId);
          // keep local variable up-to-date for response below
          (user as any).avatarUrl = publicPath;
        } else {
          // avoid retry storm if Telegram is temporarily unavailable
          await this.usersRepository.touchAvatarSyncedAt(userId);
        }
      }
    } catch {
      // ignore avatar sync errors (do not break /me)
    }
    const hw = await this.submissionsRepository.getStudentHomeworkAvgScore(userId);

    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found',
        error: 'Unauthorized',
      });
    }

    // Return UserV1 only (do not expose bannedAt)
    const userV1: ContractsV1.UserV1 = {
      id: user.id,
      telegramUserId: user.telegramUserId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      email: (user as any).email ?? null,
      streakDays: (user as any).streakDays ?? 0,
      homeworkAvgScore: hw.avgScore,
      platformRole: ((user as { platformRole?: ContractsV1.PlatformRoleV1 }).platformRole ??
        'user') as ContractsV1.PlatformRoleV1,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return { user: userV1 };
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update my profile (first/last/email)' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateMyProfile(
    @Body() body: unknown,
    @Request()
    request: { user?: { userId: string; telegramUserId: string } },
  ): Promise<ContractsV1.GetMeResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({ message: 'User not found in request', error: 'Unauthorized' });
    }
    const parsed = ContractsV1.UpdateMyProfileRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const data = parsed.data;
    const updated = await this.usersRepository.updateProfile({
      userId,
      firstName: data.firstName ?? undefined,
      lastName: data.lastName ?? undefined,
      email: data.email ?? undefined,
    });
    return { user: updated as any };
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload my avatar (multipart)' })
  @ApiResponse({ status: 201, description: 'Avatar updated' })
  async uploadMyAvatar(
    @Req()
    req: import('fastify').FastifyRequest & {
      user?: { userId: string };
      file?: (opts?: any) => Promise<any>;
    },
  ): Promise<ContractsV1.GetMeResponseV1> {
    const userId = (req as any).user?.userId as string | undefined;
    if (!userId) throw new UnauthorizedException({ message: 'Unauthorized', error: 'Unauthorized' });
    const file = await (req as any).file?.();
    if (!file) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'file is required' });
    }
    const buf: Buffer = await file.toBuffer();
    if (!buf || buf.length === 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Empty file' });
    }
    const original = typeof file.filename === 'string' && file.filename ? file.filename : 'avatar';
    const safeName = original.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `avatars/${userId}/${Date.now()}-${safeName}`;
    await this.storage.putObject({
      key,
      body: new Uint8Array(buf),
      contentType: file.mimetype ?? null,
    });
    // Same approach as course cover: store a public API path.
    const publicPath = `/public/avatar?key=${encodeURIComponent(key)}`;
    const updated = await this.usersRepository.updateAvatarUrl(userId, publicPath);
    return { user: updated as any };
  }

  @Post('me/telegram/connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connect Telegram WebApp identity to my account' })
  @ApiResponse({ status: 200, description: 'Telegram connected' })
  async connectTelegram(
    @Body() body: unknown,
    @Request() request: { user?: { userId: string } },
  ): Promise<ContractsV1.GetMeResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({ message: 'Unauthorized', error: 'Unauthorized' });
    }
    const parsed = ContractsV1.AuthTelegramRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    if (!env.TELEGRAM_BOT_TOKEN) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Telegram is not configured' });
    }
    try {
      const validated = validateTelegramInitData(
        parsed.data.initData,
        env.TELEGRAM_BOT_TOKEN,
        env.TELEGRAM_INITDATA_MAX_AGE_SECONDS,
      );

      // If this telegram is already linked to a different user:
      // - if that account is TG-first (no email/password) → migrate student progress into current account and detach
      // - else → reject
      const existing = await this.usersRepository.findByTelegramUserId(validated.telegramUserId);
      if (existing && existing.id !== userId) {
        const tgFirst = !existing.email && !existing.passwordHash;
        if (!tgFirst) {
          throw new BadRequestException({
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Telegram already linked to another account',
          });
        }
        await this.usersRepository.mergeUserData({ fromUserId: existing.id, toUserId: userId });
        await this.usersRepository.unlinkTelegram(existing.id);
      }

      const res = await this.usersRepository.connectTelegram({
        userId,
        telegramUserId: validated.telegramUserId,
        username: validated.username ?? null,
        firstName: validated.firstName ?? null,
        lastName: validated.lastName ?? null,
        avatarUrl: validated.avatarUrl ?? null,
      });
      if (!res.ok) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Telegram already linked to another account',
        });
      }
      return { user: res.user as any };
    } catch (e) {
      if (e instanceof TelegramInitDataValidationError) {
        throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: e.message });
      }
      throw e;
    }
  }

  @Get('me/referral')
  @ApiOperation({ summary: 'Get my referral code (creates if missing)' })
  @ApiResponse({ status: 200, description: 'Referral code' })
  async getMyReferral(
    @Request()
    request: {
      user?: { userId: string; telegramUserId: string };
    },
  ): Promise<ContractsV1.GetMyReferralResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'User not found in request',
        error: 'Unauthorized',
      });
    }
    const code = await this.usersRepository.getOrCreateReferralCode(userId);
    return { code };
  }

  @Get('me/commissions')
  @ApiOperation({ summary: 'List my commissions by my referral code' })
  @ApiResponse({ status: 200, description: 'Commissions list' })
  async listMyCommissions(
    @Request()
    request: {
      user?: { userId: string; telegramUserId: string };
    },
  ): Promise<ContractsV1.MeCommissionsResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'User not found in request',
        error: 'Unauthorized',
      });
    }
    const code = await this.usersRepository.getOrCreateReferralCode(userId);
    const res = await this.commissionsRepository.list({ limit: 100, referralCode: code });
    return {
      items: res.items.map((c) => ({
        id: c.id,
        orderId: c.order_id,
        referralCode: c.referral_code,
        amountCents: c.amount_cents ?? 0,
        createdAt: c.created_at.toISOString(),
      })),
    };
  }

  @Get('me/referral/stats')
  @ApiOperation({ summary: 'Get my referral stats (enrollments/orders/commissions)' })
  @ApiResponse({ status: 200, description: 'Referral stats' })
  async getMyReferralStats(
    @Request()
    request: {
      user?: { userId: string; telegramUserId: string };
    },
  ): Promise<ContractsV1.MeReferralStatsResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'User not found in request',
        error: 'Unauthorized',
      });
    }
    const code = await this.usersRepository.getOrCreateReferralCode(userId);

    const [enrollmentsCount, ordersCount, paidOrdersCount, commissions] = await Promise.all([
      this.enrollmentsRepository.countByReferralCode({ referralCode: code }),
      this.ordersRepository.countByReferralCode({ referralCode: code }),
      this.ordersRepository.countByReferralCode({ referralCode: code, status: 'paid' }),
      this.commissionsRepository.list({ limit: 200, referralCode: code }),
    ]);

    const commissionTotalCents = (commissions.items ?? []).reduce((sum, c) => sum + (c.amount_cents ?? 0), 0);
    return { code, enrollmentsCount, ordersCount, paidOrdersCount, commissionTotalCents };
  }

  @Get('me/contact')
  @ApiOperation({ summary: 'Get my contact (email/phone) for receipts' })
  @ApiResponse({ status: 200, description: 'Contact' })
  async getMyContact(
    @Request()
    request: {
      user?: { userId: string; telegramUserId: string };
    },
  ): Promise<ContractsV1.GetMyContactResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'User not found in request',
        error: 'Unauthorized',
      });
    }
    const contact = await this.usersRepository.getContact(userId);
    return { contact };
  }

  @Patch('me/contact')
  @ApiOperation({ summary: 'Update my contact (email/phone) for receipts' })
  @ApiResponse({ status: 200, description: 'Contact updated' })
  async updateMyContact(
    @Body() body: ContractsV1.UpdateMyContactRequestV1,
    @Request()
    request: {
      user?: { userId: string; telegramUserId: string };
    },
  ): Promise<ContractsV1.UpdateMyContactResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'User not found in request',
        error: 'Unauthorized',
      });
    }
    const parsed = ContractsV1.UpdateMyContactRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Validation failed' });
    }
    await this.usersRepository.updateContact({
      userId,
      email: parsed.data.email ?? undefined,
      phone: parsed.data.phone ?? undefined,
    });
    const contact = await this.usersRepository.getContact(userId);
    return { contact };
  }

  @Get('me/payout-requests')
  @ApiOperation({ summary: 'List my partner payout requests (stub workflow)' })
  @ApiResponse({ status: 200, description: 'Payout requests' })
  async listMyPayoutRequests(
    @Request()
    request: {
      user?: { userId: string; telegramUserId: string };
    },
  ): Promise<ContractsV1.ListMyPayoutRequestsResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'User not found in request',
        error: 'Unauthorized',
      });
    }
    const items = await this.payoutRequestsRepository.listByUserId(userId);
    return { items };
  }

  @Post('me/payout-requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create payout request (stub / no bank integration)' })
  @ApiResponse({ status: 201, description: 'Created' })
  async createMyPayoutRequest(
    @Body() body: unknown,
    @Request()
    request: {
      user?: { userId: string; telegramUserId: string };
    },
  ): Promise<{ item: ContractsV1.PartnerPayoutRequestV1 }> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        message: 'User not found in request',
        error: 'Unauthorized',
      });
    }
    const parsed = ContractsV1.CreatePartnerPayoutRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Validation failed' });
    }
    const item = await this.payoutRequestsRepository.create({
      userId,
      amountCents: parsed.data.amountCents,
    });
    return { item };
  }
}
