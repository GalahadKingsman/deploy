import { BadRequestException, Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { UsersRepository } from '../../users/users.repository.js';

function daysRemainingFromEnd(end: Date | null, now: Date): number | null {
  if (!end) return null;
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 86_400_000);
}

@ApiTags('User')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeExpertBillingController {
  constructor(private readonly usersRepository: UsersRepository) {}

  @Get('me/expert-billing')
  @ApiOperation({ summary: 'Expert subscription billing summary for profile UI' })
  @ApiResponse({ status: 200, description: 'Billing snapshot' })
  async getBilling(@Request() request: { user?: { userId: string } }): Promise<ContractsV1.MeExpertBillingResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new BadRequestException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    const row = await this.usersRepository.getExpertBillingProfileRow(userId);
    if (!row) {
      throw new BadRequestException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    }
    const now = new Date();
    const hasWorkspace = Boolean(row.expertId);
    const end = row.currentPeriodEnd;
    const daysRemaining = hasWorkspace ? daysRemainingFromEnd(end, now) : null;
    return {
      hasExpertWorkspace: hasWorkspace,
      expertId: row.expertId,
      expertTitle: row.expertTitle,
      subscriptionStatus: row.subscriptionStatus ?? 'inactive',
      currentPeriodEnd: end ? end.toISOString() : null,
      daysRemaining,
      autoRenew: row.subscriptionAutoRenew,
      rebillConfigured: Boolean(row.tinkoffRebillId?.trim()),
    };
  }

  @Patch('me/expert-billing/auto-renew')
  @ApiOperation({ summary: 'Toggle subscription auto-renew (recurrent)' })
  @ApiResponse({ status: 200, description: 'Updated' })
  async patchAutoRenew(
    @Body() body: unknown,
    @Request() request: { user?: { userId: string } },
  ): Promise<ContractsV1.PatchMeExpertBillingAutoRenewResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new BadRequestException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    const parsed = ContractsV1.PatchMeExpertBillingAutoRenewRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    await this.usersRepository.setSubscriptionAutoRenew(userId, parsed.data.autoRenew);
    return { ok: true, autoRenew: parsed.data.autoRenew };
  }
}
