import { BadRequestException, Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { ExpertSubscriptionsRepository } from '../../subscriptions/expert-subscriptions.repository.js';

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
    const expertId = memberships[0]?.expertId;
    if (!expertId) {
      return null;
    }

    // Ensure row exists so frontend consistently sees inactive/active/expired.
    await this.expertSubscriptionsRepository.ensureDefault(expertId);
    return await this.expertSubscriptionsRepository.findByExpertId(expertId);
  }
}

