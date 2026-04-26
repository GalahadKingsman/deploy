import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { ExpertMemberCourseAccessRepository } from '../../experts/expert-member-course-access.repository.js';
import { ExpertStudentsRepository } from './expert-students.repository.js';

@ApiTags('Expert Students')
@Controller('experts')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertStudentsController {
  constructor(
    private readonly expertStudentsRepository: ExpertStudentsRepository,
    private readonly expertMembersRepository: ExpertMembersRepository,
    private readonly expertMemberCourseAccessRepository: ExpertMemberCourseAccessRepository,
  ) {}

  private async resolveRestrictCourseIds(
    expertId: string,
    userId: string | undefined,
  ): Promise<string[] | undefined> {
    if (!userId) return undefined;
    const m = await this.expertMembersRepository.findMember(expertId, userId);
    if (!m || m.role === 'owner') return undefined;
    return await this.expertMemberCourseAccessRepository.listCourseIdsForMember(expertId, userId);
  }

  @Get(':expertId/students')
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'List students (per active enrollment) with progress and activity' })
  @ApiResponse({ status: 200, description: 'Students table + aggregates' })
  async list(
    @Param('expertId') expertId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ListExpertStudentsResponseV1> {
    const restrictToCourseIds = await this.resolveRestrictCourseIds(expertId, req.user?.userId);
    return this.expertStudentsRepository.listForExpert({ expertId, restrictToCourseIds });
  }
}
