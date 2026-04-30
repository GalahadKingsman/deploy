import { Controller, Get, BadRequestException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { ExpertMemberCourseAccessRepository } from '../../experts/expert-member-course-access.repository.js';
import { UsersRepository } from '../../users/users.repository.js';
import { ExpertDashboardRepository } from './expert-dashboard.repository.js';

@ApiTags('Expert Dashboard')
@Controller('experts')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertDashboardController {
  constructor(
    private readonly expertDashboardRepository: ExpertDashboardRepository,
    private readonly usersRepository: UsersRepository,
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

  @Get(':expertId/dashboard')
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'Expert workspace dashboard (monthly aggregates, activity, homework preview)' })
  @ApiQuery({ name: 'year', required: true, example: 2026 })
  @ApiQuery({ name: 'month', required: true, example: 4, description: '1–12' })
  @ApiResponse({ status: 200, description: 'Dashboard payload' })
  async getDashboard(
    @Param('expertId') expertId: string,
    @Query('year') yearStr: string,
    @Query('month') monthStr: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ExpertDashboardResponseV1> {
    const year = parseInt(String(yearStr ?? ''), 10);
    const month = parseInt(String(monthStr ?? ''), 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid year',
      });
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid month (1–12)',
      });
    }

    const restrict = await this.resolveRestrictCourseIds(expertId, req.user?.userId);
    if (restrict !== undefined && restrict.length === 0) {
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const endExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      return {
        period: {
          year,
          month,
          startIso: start.toISOString(),
          endExclusiveIso: endExclusive.toISOString(),
        },
        students: { totalUnique: 0, newEnrollmentsInMonth: 0 },
        courses: { publishedCount: 0, draftCount: 0 },
        referral: { totalRubInMonth: 0, deltaRubVsPreviousMonth: 0 },
        homework: { pendingInMonth: 0, newTodayUtc: 0, previewItems: [] },
        activity: { items: [] },
      };
    }

    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    const referralCode = await this.usersRepository.getOrCreateReferralCode(userId);
    const now = new Date();
    const isCurrentUtcMonth = now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month;

    return this.expertDashboardRepository.getDashboard({
      expertId,
      year,
      month,
      restrictToCourseIds: restrict,
      referralCode,
      isCurrentUtcMonth,
    });
  }
}
