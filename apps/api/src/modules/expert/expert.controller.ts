import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { ExpertId } from '../../auth/expert-rbac/expert-context.decorator.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { ExpertsRepository } from '../../experts/experts.repository.js';

@ApiTags('Expert')
@Controller('experts')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertController {
  constructor(
    private readonly expertMembersRepository: ExpertMembersRepository,
    private readonly expertsRepository: ExpertsRepository,
  ) {}
  @Get(':expertId/ping')
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'Expert ping (any member with support+ role)' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'EXPERT_CONTEXT_REQUIRED' })
  @ApiResponse({
    status: 403,
    description:
      'EXPERT_MEMBERSHIP_REQUIRED, FORBIDDEN_EXPERT_ROLE, or EXPERT_SUBSCRIPTION_INACTIVE',
  })
  ping(@ExpertId() expertId: string): { ok: true; expertId: string } {
    return { ok: true, expertId };
  }

  @Get(':expertId/admin-ping')
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'Expert admin ping (manager or owner only)' })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 400, description: 'EXPERT_CONTEXT_REQUIRED' })
  @ApiResponse({
    status: 403,
    description:
      'EXPERT_MEMBERSHIP_REQUIRED, FORBIDDEN_EXPERT_ROLE, or EXPERT_SUBSCRIPTION_INACTIVE',
  })
  adminPing(@Param('expertId') _expertId: string): { ok: true } {
    return { ok: true };
  }

  @Get(':expertId/team/members')
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'List expert team members (display fields)' })
  @ApiResponse({ status: 200, description: 'Team list' })
  async listTeamMembers(@ExpertId() expertId: string): Promise<ContractsV1.ListExpertTeamResponseV1> {
    const expert = await this.expertsRepository.findExpertById(expertId);
    if (!expert) {
      throw new NotFoundException({ code: ErrorCodes.EXPERT_NOT_FOUND, message: 'Expert not found' });
    }
    const items = await this.expertMembersRepository.listTeamMembersPublic(expertId);
    return { items, createdByUserId: expert.createdByUserId };
  }
}
