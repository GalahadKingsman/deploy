import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { CoursesRepository } from '../../authoring/courses.repository.js';
import { InvitesRepository } from '../../student/student_invites.repository.js';
import { EnrollmentsRepository } from '../../student/student_enrollments.repository.js';
import { UsersRepository } from '../../users/users.repository.js';
import type { FastifyRequest } from 'fastify';

@ApiTags('Expert Access')
@Controller('experts/:expertId')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertAccessController {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly invitesRepository: InvitesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  @Get('courses/:courseId/invites')
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'List course invites (manager+)' })
  @ApiResponse({ status: 200, description: 'Invites list' })
  async listInvites(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
  ): Promise<{ items: ContractsV1.InviteV1[] }> {
    await this.coursesRepository.getById({ expertId, courseId });
    const items = await this.invitesRepository.listByCourseId(courseId);
    return { items };
  }

  @Post('courses/:courseId/invites')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create course invite (manager+)' })
  @ApiResponse({ status: 201, description: 'Invite created' })
  async createInvite(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Body() body: { maxUses?: number | null; expiresAt?: string | null },
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.InviteV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    const maxUses =
      body?.maxUses == null ? null : typeof body.maxUses === 'number' ? body.maxUses : Number(body.maxUses);
    const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
    if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 10_000)) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'maxUses must be between 1 and 10000',
      });
    }
    if (expiresAt != null && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'expiresAt must be ISO datetime',
      });
    }
    return await this.invitesRepository.create({
      courseId,
      createdByUserId: req.user?.userId ?? null,
      expiresAt,
      maxUses: maxUses ?? null,
    });
  }

  @Post('invites/:code/revoke')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke invite by code (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async revokeInvite(@Param('code') code: string): Promise<{ ok: true }> {
    await this.invitesRepository.revoke(code);
    return { ok: true };
  }

  @Post('courses/:courseId/enroll/by-telegram/:telegramUserId')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manual enroll user by Telegram ID (manager+)' })
  @ApiResponse({ status: 200, description: 'Enrollment created/updated' })
  async enrollByTelegram(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Param('telegramUserId') telegramUserId: string,
  ): Promise<ContractsV1.EnrollmentV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    const user = await this.usersRepository.findByTelegramUserId(telegramUserId);
    if (!user) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    }
    return await this.enrollmentsRepository.upsertActive({ userId: user.id, courseId, accessEnd: null });
  }

  @Post('courses/:courseId/enroll/by-username/:username')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manual enroll user by Telegram username (manager+)' })
  @ApiResponse({ status: 200, description: 'Enrollment created/updated' })
  async enrollByUsername(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Param('username') username: string,
  ): Promise<ContractsV1.EnrollmentV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    const raw = typeof username === 'string' ? username.trim() : '';
    const clean = raw.startsWith('@') ? raw.slice(1).trim() : raw;
    if (!clean) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'username is required' });
    }

    const user = await this.usersRepository.findByUsername(clean);
    if (!user) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    }
    return await this.enrollmentsRepository.upsertActive({ userId: user.id, courseId, accessEnd: null });
  }

  @Get('courses/:courseId/enrollments')
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'List enrollments for course (manager+)' })
  @ApiResponse({ status: 200, description: 'Enrollments' })
  async listEnrollments(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
  ): Promise<ContractsV1.ListExpertCourseEnrollmentsResponseV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    const items = await this.enrollmentsRepository.listForCourseWithStudents(courseId);
    return { items };
  }

  @Post('courses/:courseId/enrollments/:enrollmentId/extend')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extend enrollment access by N days (manager+)' })
  @ApiResponse({ status: 200, description: 'Updated enrollment' })
  async extendEnrollment(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: unknown,
  ): Promise<{ enrollment: ContractsV1.EnrollmentV1 }> {
    await this.coursesRepository.getById({ expertId, courseId });
    const parsed = ContractsV1.ExtendEnrollmentRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const current = await this.enrollmentsRepository.findById(enrollmentId);
    if (!current || current.courseId !== courseId) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Enrollment not found' });
    }
    const enrollment = await this.enrollmentsRepository.extendByGrantDays(enrollmentId, parsed.data.grantDays);
    if (!enrollment) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Enrollment not found' });
    }
    return { enrollment };
  }

  @Post('courses/:courseId/enrollments/:enrollmentId/revoke')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke enrollment (manager+)' })
  @ApiResponse({ status: 200, description: 'Revoked' })
  async revokeEnrollmentRow(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<{ enrollment: ContractsV1.EnrollmentV1 }> {
    await this.coursesRepository.getById({ expertId, courseId });
    const current = await this.enrollmentsRepository.findById(enrollmentId);
    if (!current || current.courseId !== courseId) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Enrollment not found' });
    }
    const enrollment = await this.enrollmentsRepository.revokeEnrollment(enrollmentId);
    if (!enrollment) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Enrollment not found' });
    }
    return { enrollment };
  }
}

