import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Pool } from 'pg';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { ExpertMemberCourseAccessRepository } from '../../experts/expert-member-course-access.repository.js';
import { ExpertsRepository } from '../../experts/experts.repository.js';
import { UsersRepository } from '../../users/users.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import { CoursesRepository } from '../../authoring/courses.repository.js';

function traceIdFrom(req: FastifyRequest & { traceId?: string }): string | null {
  const h = req.headers?.['x-request-id'];
  return (
    req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null
  );
}

@ApiTags('Expert Team')
@Controller('experts/:expertId/team')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertTeamController {
  constructor(
    @Inject(Pool) private readonly pool: Pool,
    private readonly expertMembersRepository: ExpertMembersRepository,
    private readonly expertMemberCourseAccessRepository: ExpertMemberCourseAccessRepository,
    private readonly expertsRepository: ExpertsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly coursesRepository: CoursesRepository,
  ) {}

  /**
   * Membership role `owner` or expert workspace creator (`experts.created_by_user_id`).
   * Guard is `manager+`; this narrows to actual owners/creators.
   */
  private async assertOwnerOrExpertCreator(expertId: string, userId: string | undefined): Promise<void> {
    if (!userId) {
      throw new ForbiddenException({
        code: ErrorCodes.EXPERT_MEMBERSHIP_REQUIRED,
        message: 'Authentication required',
      });
    }
    const member = await this.expertMembersRepository.findMember(expertId, userId);
    if (member?.role === 'owner') {
      return;
    }
    const expert = await this.expertsRepository.findExpertById(expertId);
    if (expert && expert.createdByUserId === userId) {
      return;
    }
    const n = await this.expertMembersRepository.countMembersForExpert(expertId);
    if (n === 1 && member) {
      return;
    }
    throw new ForbiddenException({
      code: ErrorCodes.FORBIDDEN_EXPERT_ROLE,
      message: 'Only the expert owner or the workspace creator can manage the team',
    });
  }

  @Get('users/search')
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'Search users to add to team (owner or expert creator)' })
  @ApiResponse({ status: 200, description: 'Users' })
  async searchUsersForTeam(
    @Param('expertId') expertId: string,
    @Query('q') q: string | undefined,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{ items: Array<Pick<ContractsV1.UserV1, 'id' | 'telegramUserId' | 'username' | 'firstName' | 'lastName'>> }> {
    await this.assertOwnerOrExpertCreator(expertId, req.user?.userId);
    const qq = typeof q === 'string' ? q.trim() : '';
    if (!qq) return { items: [] };
    const res = await this.usersRepository.adminList({ q: qq, limit: 20, offset: 0 });
    return {
      items: (res.items ?? []).map((u) => ({
        id: u.id,
        telegramUserId: u.telegramUserId,
        username: u.username ?? undefined,
        firstName: u.firstName ?? undefined,
        lastName: u.lastName ?? undefined,
      })),
    };
  }

  @Post('members')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add team member by user id with course scope (owner or expert creator)' })
  @ApiResponse({ status: 201, description: 'Member added' })
  async addByUserId(
    @Param('expertId') expertId: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ member: ContractsV1.ExpertMemberV1 }> {
    await this.assertOwnerOrExpertCreator(expertId, req.user?.userId);
    const parsed = ContractsV1.AddExpertTeamMemberByUserRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const target = await this.usersRepository.findById(parsed.data.userId);
    if (!target) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    }
    const existing = await this.expertMembersRepository.findMember(expertId, parsed.data.userId);
    if (existing) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'User is already a team member' });
    }
    await this.coursesRepository.assertAllCoursesBelongToExpert(expertId, parsed.data.courseIds);

    const client = await this.pool.connect();
    let member: ContractsV1.ExpertMemberV1;
    try {
      await client.query('BEGIN');
      member = await this.expertMembersRepository.addMemberWithClient(client, {
        expertId,
        userId: parsed.data.userId,
        role: parsed.data.role,
      });
      await this.expertMemberCourseAccessRepository.insertPairsForMember(
        client,
        expertId,
        parsed.data.userId,
        parsed.data.courseIds,
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.team.add_by_user',
      entityType: 'expert',
      entityId: expertId,
      meta: {
        expertId,
        addedUserId: parsed.data.userId,
        role: parsed.data.role,
        courseIds: parsed.data.courseIds,
      },
      traceId: traceIdFrom(req),
    });
    return { member };
  }

  @Post('members/by-telegram/:telegramUserId')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add team member by Telegram user id (owner or expert creator)' })
  @ApiResponse({ status: 201, description: 'Member added' })
  async addByTelegram(
    @Param('expertId') expertId: string,
    @Param('telegramUserId') telegramUserId: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ member: ContractsV1.ExpertMemberV1 }> {
    await this.assertOwnerOrExpertCreator(expertId, req.user?.userId);
    const parsed = ContractsV1.AddExpertTeamMemberRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const tg = telegramUserId.trim();
    if (!tg) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'telegramUserId required' });
    }
    const user = await this.usersRepository.findByTelegramUserId(tg);
    if (!user) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found for this Telegram id' });
    }
    const existing = await this.expertMembersRepository.findMember(expertId, user.id);
    if (existing) {
      throw new ConflictException({ code: ErrorCodes.CONFLICT, message: 'User is already a team member' });
    }
    const member = await this.expertMembersRepository.addMember({
      expertId,
      userId: user.id,
      role: parsed.data.role,
    });
    if (parsed.data.role !== 'owner') {
      const c = await this.pool.connect();
      try {
        await this.expertMemberCourseAccessRepository.grantAllNonDeletedCoursesForMember(c, expertId, user.id);
      } finally {
        c.release();
      }
    }
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.team.add',
      entityType: 'expert',
      entityId: expertId,
      meta: { expertId, addedUserId: user.id, role: parsed.data.role, telegramUserId: tg },
      traceId: traceIdFrom(req),
    });
    return { member };
  }

  @Patch('members/:userId')
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'Change team member role (owner or expert creator)' })
  @ApiResponse({ status: 200, description: 'Updated' })
  async updateRole(
    @Param('expertId') expertId: string,
    @Param('userId') targetUserId: string,
    @Body() body: unknown,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ member: ContractsV1.ExpertMemberV1 }> {
    await this.assertOwnerOrExpertCreator(expertId, req.user?.userId);
    const parsed = ContractsV1.UpdateExpertTeamMemberRoleRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const current = await this.expertMembersRepository.findMember(expertId, targetUserId);
    if (!current) {
      throw new NotFoundException({ code: ErrorCodes.EXPERT_MEMBER_NOT_FOUND, message: 'Member not found' });
    }
    if (current.role === 'owner' && parsed.data.role !== 'owner') {
      const owners = await this.expertMembersRepository.countOwners(expertId);
      if (owners <= 1) {
        throw new ForbiddenException({
          code: ErrorCodes.CONFLICT,
          message: 'Cannot demote the last owner',
        });
      }
    }
    const member = await this.expertMembersRepository.updateMemberRole(
      expertId,
      targetUserId,
      parsed.data.role,
    );
    if (parsed.data.role === 'owner') {
      await this.expertMemberCourseAccessRepository.deleteAllForMember(expertId, targetUserId);
    } else {
      const cnt = await this.expertMemberCourseAccessRepository.countForMember(expertId, targetUserId);
      if (cnt === 0) {
        const c = await this.pool.connect();
        try {
          await this.expertMemberCourseAccessRepository.grantAllNonDeletedCoursesForMember(
            c,
            expertId,
            targetUserId,
          );
        } finally {
          c.release();
        }
      }
    }
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.team.role_change',
      entityType: 'expert',
      entityId: expertId,
      meta: { expertId, userId: targetUserId, prevRole: current.role, role: parsed.data.role },
      traceId: traceIdFrom(req),
    });
    return { member };
  }

  @Delete('members/:userId')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove team member (owner or expert creator)' })
  @ApiResponse({ status: 200, description: 'Removed' })
  async remove(
    @Param('expertId') expertId: string,
    @Param('userId') targetUserId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true }> {
    await this.assertOwnerOrExpertCreator(expertId, req.user?.userId);
    const current = await this.expertMembersRepository.findMember(expertId, targetUserId);
    if (!current) {
      throw new NotFoundException({ code: ErrorCodes.EXPERT_MEMBER_NOT_FOUND, message: 'Member not found' });
    }
    if (current.role === 'owner') {
      const owners = await this.expertMembersRepository.countOwners(expertId);
      if (owners <= 1) {
        throw new ForbiddenException({
          code: ErrorCodes.CONFLICT,
          message: 'Cannot remove the last owner',
        });
      }
    }
    await this.expertMembersRepository.removeMember(expertId, targetUserId);
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.team.remove',
      entityType: 'expert',
      entityId: expertId,
      meta: { expertId, userId: targetUserId, prevRole: current.role },
      traceId: traceIdFrom(req),
    });
    return { ok: true };
  }
}
