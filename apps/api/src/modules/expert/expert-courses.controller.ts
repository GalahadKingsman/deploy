import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { CoursesRepository } from '../../authoring/courses.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import type { FastifyRequest } from 'fastify';

function getTraceId(req: FastifyRequest & { traceId?: string }): string | null {
  const h = req.headers?.['x-request-id'];
  return req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;
}

@ApiTags('Expert Courses')
@Controller('experts/:expertId/courses')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertCoursesController {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'List expert courses (support+)' })
  @ApiResponse({ status: 200, description: 'List of courses' })
  async list(
    @Param('expertId') expertId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ): Promise<ContractsV1.ListExpertCoursesResponseV1> {
    const statusParsed = status
      ? ContractsV1.CourseStatusV1Schema.safeParse(status)
      : ({ success: true, data: undefined } as const);
    if (!statusParsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid status',
        errors: statusParsed.error.errors,
      });
    }

    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const offset = offsetStr ? parseInt(offsetStr, 10) : undefined;

    const items = await this.coursesRepository.listByExpertId({
      expertId,
      status: statusParsed.data,
      query: q ?? undefined,
      limit,
      offset,
    });
    return { items };
  }

  @Post()
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create course (manager+)' })
  @ApiResponse({ status: 201, description: 'Course created' })
  async create(
    @Param('expertId') expertId: string,
    @Body() body: ContractsV1.CreateExpertCourseRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertCourseV1> {
    const parsed = ContractsV1.CreateExpertCourseRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }

    const created = await this.coursesRepository.create({
      expertId,
      id: randomUUID(),
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      coverUrl: parsed.data.coverUrl ?? null,
      priceCents: parsed.data.priceCents ?? 0,
      currency: (parsed.data.currency ?? 'RUB').trim(),
      visibility: parsed.data.visibility ?? 'private',
    });

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course.create',
      entityType: 'course',
      entityId: created.id,
      meta: { expertId, title: created.title },
      traceId: getTraceId(req),
    });

    return created;
  }

  @Get(':courseId')
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'Get course (support+)' })
  @ApiResponse({ status: 200, description: 'Course' })
  async get(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
  ): Promise<ContractsV1.ExpertCourseV1> {
    return await this.coursesRepository.getById({ expertId, courseId });
  }

  @Patch(':courseId')
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'Update course (manager+)' })
  @ApiResponse({ status: 200, description: 'Course updated' })
  async update(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Body() body: ContractsV1.UpdateExpertCourseRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertCourseV1> {
    const parsed = ContractsV1.UpdateExpertCourseRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }

    const updated = await this.coursesRepository.update({ expertId, courseId, patch: parsed.data });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course.update',
      entityType: 'course',
      entityId: updated.id,
      meta: { expertId },
      traceId: getTraceId(req),
    });
    return updated;
  }

  @Post(':courseId/publish')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish course (manager+)' })
  @ApiResponse({ status: 200, description: 'Course published' })
  async publish(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertCourseV1> {
    const updated = await this.coursesRepository.publish({ expertId, courseId });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course.publish',
      entityType: 'course',
      entityId: updated.id,
      meta: { expertId },
      traceId: getTraceId(req),
    });
    return updated;
  }

  @Post(':courseId/unpublish')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish course (manager+)' })
  @ApiResponse({ status: 200, description: 'Course unpublished' })
  async unpublish(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertCourseV1> {
    const updated = await this.coursesRepository.unpublish({ expertId, courseId });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course.unpublish',
      entityType: 'course',
      entityId: updated.id,
      meta: { expertId },
      traceId: getTraceId(req),
    });
    return updated;
  }

  @Delete(':courseId')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete course (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async remove(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true }> {
    await this.coursesRepository.softDelete({ expertId, courseId });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course.delete',
      entityType: 'course',
      entityId: courseId,
      meta: { expertId },
      traceId: getTraceId(req),
    });
    return { ok: true };
  }
}

