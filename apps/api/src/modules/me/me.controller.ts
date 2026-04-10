import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
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

    // Find user by ID
    const user = await this.usersRepository.findById(userId);

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
      platformRole: ((user as { platformRole?: ContractsV1.PlatformRoleV1 }).platformRole ??
        'user') as ContractsV1.PlatformRoleV1,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return { user: userV1 };
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
