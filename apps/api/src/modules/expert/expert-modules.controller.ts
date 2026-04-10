import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
import { CourseModulesRepository } from '../../authoring/course-modules.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import type { FastifyRequest } from 'fastify';

function getTraceId(req: FastifyRequest & { traceId?: string }): string | null {
  const h = req.headers?.['x-request-id'];
  return req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;
}

@ApiTags('Expert Modules')
@Controller('experts/:expertId/courses/:courseId/modules')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertModulesController {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly courseModulesRepository: CourseModulesRepository,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'List course modules (support+)' })
  @ApiResponse({ status: 200, description: 'Modules list' })
  async list(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
  ): Promise<ContractsV1.ListExpertCourseModulesResponseV1> {
    // ensure course belongs to expert (and not deleted)
    await this.coursesRepository.getById({ expertId, courseId });
    const items = await this.courseModulesRepository.listByCourseId(courseId);
    return { items };
  }

  @Post()
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create module (manager+)' })
  @ApiResponse({ status: 201, description: 'Module created' })
  async create(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Body() body: ContractsV1.CreateExpertCourseModuleRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertCourseModuleV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    const parsed = ContractsV1.CreateExpertCourseModuleRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    const created = await this.courseModulesRepository.create({
      id: randomUUID(),
      courseId,
      title: parsed.data.title,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course_module.create',
      entityType: 'course_module',
      entityId: created.id,
      meta: { expertId, courseId, title: created.title },
      traceId: getTraceId(req),
    });
    return created;
  }

  @Patch(':moduleId')
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'Update module (manager+)' })
  @ApiResponse({ status: 200, description: 'Module updated' })
  async update(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Body() body: ContractsV1.UpdateExpertCourseModuleRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertCourseModuleV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    const parsed = ContractsV1.UpdateExpertCourseModuleRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    const updated = await this.courseModulesRepository.update({
      courseId,
      moduleId,
      patch: parsed.data,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course_module.update',
      entityType: 'course_module',
      entityId: updated.id,
      meta: { expertId, courseId },
      traceId: getTraceId(req),
    });
    return updated;
  }

  @Post('reorder')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder modules (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async reorder(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Body() body: ContractsV1.ReorderExpertCourseModulesRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true }> {
    await this.coursesRepository.getById({ expertId, courseId });
    const parsed = ContractsV1.ReorderExpertCourseModulesRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    await this.courseModulesRepository.reorder({ courseId, items: parsed.data.items });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course_module.reorder',
      entityType: 'course',
      entityId: courseId,
      meta: { expertId, courseId, count: parsed.data.items.length },
      traceId: getTraceId(req),
    });
    return { ok: true };
  }

  @Delete(':moduleId')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete module (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async remove(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true }> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.courseModulesRepository.softDelete({ courseId, moduleId });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course_module.delete',
      entityType: 'course_module',
      entityId: moduleId,
      meta: { expertId, courseId },
      traceId: getTraceId(req),
    });
    return { ok: true };
  }
}

