import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { RequirePlatformRole } from '../../auth/rbac/require-platform-role.decorator.js';
import { ExpertsRepository } from '../../experts/experts.repository.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { ExpertMemberCourseAccessRepository } from '../../experts/expert-member-course-access.repository.js';
import { ExpertSubscriptionsRepository } from '../../subscriptions/expert-subscriptions.repository.js';
import { UsersRepository } from '../../users/users.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import type { FastifyRequest } from 'fastify';

interface ReqWithUser extends FastifyRequest {
  user?: { userId: string };
  traceId?: string;
}

@ApiTags('Admin')
@Controller('admin/experts')
@UseGuards(JwtAuthGuard, PlatformRoleGuard)
@ApiBearerAuth()
export class AdminExpertsController {
  constructor(
    private readonly expertsRepository: ExpertsRepository,
    private readonly expertMembersRepository: ExpertMembersRepository,
    @Inject(Pool) private readonly pool: Pool,
    private readonly expertMemberCourseAccessRepository: ExpertMemberCourseAccessRepository,
    private readonly expertSubscriptionsRepository: ExpertSubscriptionsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @RequirePlatformRole('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create expert and add owner member (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        ownerUserId: { type: 'string', format: 'uuid' },
      },
      required: ['title', 'ownerUserId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Expert created' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  @ApiResponse({ status: 404, description: 'Owner user not found' })
  async createExpert(
    @Body() body: { title?: string; slug?: string; ownerUserId?: string },
    @Req() req: ReqWithUser,
  ): Promise<{ id: string }> {
    const title = body?.title;
    const slug = body?.slug ?? null;
    const ownerUserId = body?.ownerUserId;

    if (typeof title !== 'string' || !title.trim()) {
      throw new BadRequestException({
        message: 'title is required',
      });
    }
    if (typeof ownerUserId !== 'string' || !ownerUserId) {
      throw new BadRequestException({
        message: 'ownerUserId is required',
      });
    }

    const ownerUser = await this.usersRepository.findById(ownerUserId);
    if (!ownerUser) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: 'Owner user not found',
      });
    }

    const expertId = randomUUID();
    const h = req.headers?.['x-request-id'];
    const traceId =
      req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;

    await this.expertsRepository.createExpert({
      id: expertId,
      title: title.trim(),
      slug: slug && typeof slug === 'string' ? slug.trim() || null : null,
      createdByUserId: ownerUserId,
    });

    await this.expertSubscriptionsRepository.ensureDefault(expertId);

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.expert.create',
      entityType: 'expert',
      entityId: expertId,
      meta: { title: title.trim(), slug, ownerUserId },
      traceId,
    });

    await this.expertMembersRepository.addMember({
      expertId,
      userId: ownerUserId,
      role: 'owner',
    });

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.expert.member.add',
      entityType: 'expert_member',
      entityId: `${expertId}:${ownerUserId}`,
      meta: { expertId, userId: ownerUserId, role: 'owner' },
      traceId,
    });

    return { id: expertId };
  }

  @Post(':expertId/members')
  @RequirePlatformRole('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add expert member (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', format: 'uuid' },
        role: { type: 'string', enum: ['owner', 'manager', 'reviewer', 'support'] },
      },
      required: ['userId', 'role'],
    },
  })
  @ApiResponse({ status: 201, description: 'Member added' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  @ApiResponse({ status: 404, description: 'Expert not found' })
  @ApiResponse({ status: 409, description: 'EXPERT_MEMBER_ALREADY_EXISTS' })
  async addMember(
    @Param('expertId') expertId: string,
    @Body() body: { userId?: string; role?: string },
    @Req() req: ReqWithUser,
  ): Promise<{ ok: true }> {
    const userId = body?.userId;
    const roleRaw = body?.role;

    if (typeof userId !== 'string' || !userId) {
      throw new BadRequestException({ message: 'userId is required' });
    }

    const roleValidation = ContractsV1.ExpertMemberRoleV1Schema.safeParse(roleRaw);
    if (!roleValidation.success) {
      throw new BadRequestException({
        message: 'Invalid role',
        code: ErrorCodes.INVALID_EXPERT_MEMBER_ROLE,
        errors: roleValidation.error.errors,
      });
    }
    const role = roleValidation.data;

    const expert = await this.expertsRepository.findExpertById(expertId);
    if (!expert) {
      throw new NotFoundException({
        code: ErrorCodes.EXPERT_NOT_FOUND,
        message: 'Expert not found',
      });
    }

    const existing = await this.expertMembersRepository.findMember(expertId, userId);
    if (existing) {
      throw new ConflictException({
        code: ErrorCodes.EXPERT_MEMBER_ALREADY_EXISTS,
        message: 'Expert member already exists',
      });
    }

    await this.expertMembersRepository.addMember({ expertId, userId, role });
    if (role !== 'owner') {
      const c = await this.pool.connect();
      try {
        await this.expertMemberCourseAccessRepository.grantAllNonDeletedCoursesForMember(c, expertId, userId);
      } finally {
        c.release();
      }
    }

    const h = req.headers?.['x-request-id'];
    const traceId =
      req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.expert.member.add',
      entityType: 'expert_member',
      entityId: `${expertId}:${userId}`,
      meta: { expertId, userId, role },
      traceId,
    });

    return { ok: true };
  }

  @Patch(':expertId/members/:userId')
  @RequirePlatformRole('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update expert member role (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { role: { type: 'string', enum: ['owner', 'manager', 'reviewer', 'support'] } },
      required: ['role'],
    },
  })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  @ApiResponse({ status: 404, description: 'EXPERT_MEMBER_NOT_FOUND' })
  async updateMemberRole(
    @Param('expertId') expertId: string,
    @Param('userId') userId: string,
    @Body() body: { role?: string },
    @Req() req: ReqWithUser,
  ): Promise<{ ok: true }> {
    const roleValidation = ContractsV1.ExpertMemberRoleV1Schema.safeParse(body?.role);
    if (!roleValidation.success) {
      throw new BadRequestException({
        message: 'Invalid role',
        code: ErrorCodes.INVALID_EXPERT_MEMBER_ROLE,
        errors: roleValidation.error.errors,
      });
    }
    const to = roleValidation.data;

    const existing = await this.expertMembersRepository.findMember(expertId, userId);
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.EXPERT_MEMBER_NOT_FOUND,
        message: 'Expert member not found',
      });
    }
    const from = existing.role;

    await this.expertMembersRepository.updateMemberRole(expertId, userId, to);
    if (to === 'owner') {
      await this.expertMemberCourseAccessRepository.deleteAllForMember(expertId, userId);
    } else {
      const cnt = await this.expertMemberCourseAccessRepository.countForMember(expertId, userId);
      if (cnt === 0) {
        const c = await this.pool.connect();
        try {
          await this.expertMemberCourseAccessRepository.grantAllNonDeletedCoursesForMember(c, expertId, userId);
        } finally {
          c.release();
        }
      }
    }

    const h = req.headers?.['x-request-id'];
    const traceId =
      req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.expert.member.role.set',
      entityType: 'expert_member',
      entityId: `${expertId}:${userId}`,
      meta: { from, to },
      traceId,
    });

    return { ok: true };
  }

  @Delete(':expertId/members/:userId')
  @RequirePlatformRole('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove expert member (admin only)' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  @ApiResponse({ status: 404, description: 'EXPERT_MEMBER_NOT_FOUND' })
  async removeMember(
    @Param('expertId') expertId: string,
    @Param('userId') userId: string,
    @Req() req: ReqWithUser,
  ): Promise<{ ok: true }> {
    const existing = await this.expertMembersRepository.findMember(expertId, userId);
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCodes.EXPERT_MEMBER_NOT_FOUND,
        message: 'Expert member not found',
      });
    }

    await this.expertMembersRepository.removeMember(expertId, userId);

    const h = req.headers?.['x-request-id'];
    const traceId =
      req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.expert.member.remove',
      entityType: 'expert_member',
      entityId: `${expertId}:${userId}`,
      meta: { expertId, userId, role: existing.role },
      traceId,
    });

    return { ok: true };
  }
}
