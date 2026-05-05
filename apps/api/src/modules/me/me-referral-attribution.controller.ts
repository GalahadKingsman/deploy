import { Controller, Get, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { UsersRepository } from '../../users/users.repository.js';
import { ReferralAttributionRepository } from '../../users/referral-attribution.repository.js';
import { buildReferralDisplayName } from '../../users/referral-attribution.service.js';

@ApiTags('Referral')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeReferralAttributionController {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly referralAttributionRepository: ReferralAttributionRepository,
  ) {}

  @Get('me/referral/inviter')
  @ApiOperation({ summary: 'Get the user who invited me (referral attribution)' })
  @ApiResponse({ status: 200, description: 'Inviter (or null) and bind timestamp' })
  async getInviter(
    @Request() req: { user?: { userId: string } },
  ): Promise<ContractsV1.GetMyReferralInviterResponseV1> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    const row = await this.referralAttributionRepository.findInviterForUser(userId);
    if (!row) return { inviter: null, referredAt: null };
    return {
      inviter: {
        userId: row.user_id,
        firstName: row.first_name ?? null,
        lastName: row.last_name ?? null,
        avatarUrl: row.avatar_url ?? null,
        displayName: buildReferralDisplayName({
          firstName: row.first_name,
          lastName: row.last_name,
          fallbackUserId: row.user_id,
        }),
      },
      referredAt: row.referred_at ? row.referred_at.toISOString() : null,
    };
  }

  @Get('me/referral/invitees')
  @ApiOperation({ summary: 'List users I invited' })
  @ApiResponse({ status: 200, description: 'List of invitees with subscription/commission stats' })
  async listInvitees(
    @Request() req: { user?: { userId: string } },
  ): Promise<ContractsV1.ListMyReferralInviteesResponseV1> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    const code = await this.usersRepository.getOrCreateReferralCode(userId);
    const rows = await this.referralAttributionRepository.listInviteesForReferrer({
      referrerUserId: userId,
      referralCode: code,
      limit: 200,
    });
    const items: ContractsV1.ReferralInviteeV1[] = rows.map((r) => ({
      userId: r.user_id,
      firstName: r.first_name ?? null,
      lastName: r.last_name ?? null,
      avatarUrl: r.avatar_url ?? null,
      displayName: buildReferralDisplayName({
        firstName: r.first_name,
        lastName: r.last_name,
        fallbackUserId: r.user_id,
      }),
      subscriptionActive: r.subscription_active === true,
      commissionTotalCents: Math.max(0, parseInt(r.commission_total_cents ?? '0', 10) || 0),
      referredAt: r.referred_at.toISOString(),
      firstPaidExpertSubscriptionAt: r.first_paid_expert_subscription_at
        ? r.first_paid_expert_subscription_at.toISOString()
        : null,
    }));
    return { items };
  }
}
