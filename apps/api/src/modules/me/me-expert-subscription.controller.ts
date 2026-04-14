import { BadRequestException, Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { ExpertSubscriptionsRepository } from '../../subscriptions/expert-subscriptions.repository.js';

function isActive(sub: ContractsV1.ExpertSubscriptionV1, nowMs: number): boolean {
  if (sub.status !== 'active') return false;
  const endMs = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null;
  return endMs == null || endMs > nowMs;
}

@ApiTags('User')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeExpertSubscriptionController {
  constructor(
    private readonly expertMembersRepository: ExpertMembersRepository,
    private readonly expertSubscriptionsRepository: ExpertSubscriptionsRepository,
  ) {}

  @Get('me/expert-subscription')
  @ApiOperation({ summary: 'Get my expert subscription (best-effort for Account CTA)' })
  @ApiResponse({ status: 200, description: 'Subscription or null' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async get(
    @Request() request: { user?: { userId: string } },
  ): Promise<ContractsV1.ExpertSubscriptionV1 | null> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new BadRequestException({
        code: ErrorCodes.UNAUTHORIZED,
        message: 'User not found in request',
      });
    }

    const memberships = await this.expertMembersRepository.listMembershipsByUserId(userId);
    if (memberships.length === 0) return null;

    const nowMs = Date.now();
    const subs: ContractsV1.ExpertSubscriptionV1[] = [];

    for (const m of memberships) {
      // Ensure row exists so frontend consistently sees inactive/active/expired.
      await this.expertSubscriptionsRepository.ensureDefault(m.expertId);
      const s = await this.expertSubscriptionsRepository.findByExpertId(m.expertId);
      if (s) subs.push(s);
    }

    if (subs.length === 0) return null;

    // Prefer ACTIVE subscription; otherwise return the most recent one by end date.
    const active = subs.filter((s) => isActive(s, nowMs));
    const pickFrom = active.length > 0 ? active : subs;
    pickFrom.sort((a, b) => {
      const ae = a.currentPeriodEnd ? new Date(a.currentPeriodEnd).getTime() : Number.POSITIVE_INFINITY;
      const be = b.currentPeriodEnd ? new Date(b.currentPeriodEnd).getTime() : Number.POSITIVE_INFINITY;
      return be - ae;
    });
    return pickFrom[0] ?? null;
  }
}

