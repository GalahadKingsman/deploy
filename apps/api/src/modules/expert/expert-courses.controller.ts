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
  NotFoundException,
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
import { S3StorageService } from '../../storage/s3-storage.service.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { ExpertMemberCourseAccessRepository } from '../../experts/expert-member-course-access.repository.js';
import { ExpertCourseAccessService } from './expert-course-access.service.js';

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
    private readonly storage: S3StorageService,
    private readonly expertMembersRepository: ExpertMembersRepository,
    private readonly expertMemberCourseAccessRepository: ExpertMemberCourseAccessRepository,
    private readonly expertCourseAccessService: ExpertCourseAccessService,
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

  @Get()
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'List expert courses (support+)' })
  @ApiResponse({ status: 200, description: 'List of courses' })
  async list(
    @Param('expertId') expertId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
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

    const restrictToCourseIds = await this.resolveRestrictCourseIds(expertId, req.user?.userId);
    const items = await this.coursesRepository.listByExpertId({
      expertId,
      status: statusParsed.data,
      query: q ?? undefined,
      limit,
      offset,
      restrictToCourseIds,
    });
    return { items };
  }

  @Get('dashboard')
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'List expert courses with dashboard stats (support+)' })
  @ApiResponse({ status: 200, description: 'Courses with module/student/completion aggregates' })
  async listDashboard(
    @Param('expertId') expertId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ): Promise<ContractsV1.ListExpertCoursesDashboardResponseV1> {
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

    const restrictToCourseIds = await this.resolveRestrictCourseIds(expertId, req.user?.userId);
    const items = await this.coursesRepository.listDashboardByExpertId({
      expertId,
      status: statusParsed.data,
      query: q ?? undefined,
      limit,
      offset,
      restrictToCourseIds,
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
      lessonAccessMode: parsed.data.lessonAccessMode,
    });

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course.create',
      entityType: 'course',
      entityId: created.id,
      meta: { expertId, title: created.title },
      traceId: getTraceId(req),
    });

    const actorId = req.user?.userId;
    if (actorId) {
      const m = await this.expertMembersRepository.findMember(expertId, actorId);
      if (m && m.role !== 'owner') {
        await this.expertMemberCourseAccessRepository.insertPair(expertId, actorId, created.id);
      }
    }

    return created;
  }

  @Post(':courseId/cover/signed')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Get signed PUT URL for course cover upload (manager+)' })
  @ApiResponse({ status: 201, description: 'Signed upload URL' })
  async createSignedCoverUpload(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Body() body: { filename?: string | null; contentType?: string | null },
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{ key: string; url: string; publicPath: string }> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });

    const original = typeof body?.filename === 'string' && body.filename ? body.filename : 'cover';
    const safeName = original.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `course-covers/${courseId}/${Date.now()}-${safeName}`;
    const contentType = typeof body?.contentType === 'string' && body.contentType ? body.contentType : null;

    const signed = await this.storage.getSignedPutUrl({ key, contentType, expiresSeconds: 120 });
    const publicPath = `/public/course-cover?key=${encodeURIComponent(key)}`;
    return { key, url: signed.url, publicPath };
  }

  @Post(':courseId/cover')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload course cover (multipart, manager+)' })
  @ApiResponse({ status: 201, description: 'Course updated' })
  async uploadCover(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Req()
    req: FastifyRequest & {
      user?: { userId: string };
      file?: (opts?: any) => Promise<any>;
    },
  ): Promise<ContractsV1.ExpertCourseV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });

    const file = await (req as any).file?.();
    if (!file) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'file is required' });
    }

    const buf: Buffer = await file.toBuffer();
    if (!buf || buf.length === 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Empty file' });
    }

    const original = typeof file.filename === 'string' && file.filename ? file.filename : 'cover';
    const safeName = original.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `course-covers/${courseId}/${Date.now()}-${safeName}`;
    await this.storage.putObject({
      key,
      body: new Uint8Array(buf),
      contentType: file.mimetype ?? null,
    });

    const publicPath = `/public/course-cover?key=${encodeURIComponent(key)}`;
    return await this.coursesRepository.update({
      expertId,
      courseId,
      patch: { coverUrl: publicPath },
    });
  }

  @Post(':courseId/certificate/upload')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload course certificate PDF (multipart, manager+)' })
  @ApiResponse({ status: 201, description: 'Certificate uploaded' })
  async uploadCertificate(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Req()
    req: FastifyRequest & {
      user?: { userId: string };
      file?: (opts?: any) => Promise<any>;
    },
  ): Promise<ContractsV1.ExpertCourseV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });

    const file = await (req as any).file?.();
    if (!file) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'file is required' });
    }
    const buf: Buffer = await file.toBuffer();
    if (!buf || buf.length === 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Empty file' });
    }
    const maxBytes = 50 * 1024 * 1024;
    if (buf.length > maxBytes) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'PDF слишком большой (максимум 50 МБ).',
      });
    }
    const isPdfMagic = buf.length >= 5 && buf.slice(0, 5).toString('ascii') === '%PDF-';
    const mime = (typeof file.mimetype === 'string' ? file.mimetype : '').toLowerCase();
    const isPdfMime = mime === 'application/pdf' || mime === 'application/x-pdf';
    if (!isPdfMagic && !isPdfMime) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Допускается только PDF.',
      });
    }

    const original = typeof file.filename === 'string' && file.filename.trim() ? file.filename.trim() : 'certificate.pdf';
    const safeName = original.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `course-certificates/${courseId}/${Date.now()}-${safeName}`;
    // Сначала БД (миграция / старый ключ), потом S3 — чтобы не оставлять «висящий» файл при ошибке SQL.
    const prev = await this.coursesRepository.getCertificate({ expertId, courseId });

    await this.storage.putObject({
      key,
      body: new Uint8Array(buf),
      contentType: 'application/pdf',
    });

    let updated: ContractsV1.ExpertCourseV1;
    try {
      updated = await this.coursesRepository.setCertificate({
        expertId,
        courseId,
        pdfKey: key,
        originalFilename: original,
      });
    } catch (e) {
      try {
        await this.storage.deleteObject({ key });
      } catch {
        // best-effort rollback
      }
      throw e;
    }
    if (prev.pdfKey && prev.pdfKey !== key) {
      try {
        await this.storage.deleteObject({ key: prev.pdfKey });
      } catch {
        // best-effort; don't fail upload because of cleanup
      }
    }
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course.certificate.upload',
      entityType: 'course',
      entityId: courseId,
      meta: { expertId, filename: original },
      traceId: getTraceId(req),
    });
    return updated;
  }

  @Post(':courseId/certificate/delete')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove course certificate PDF (manager+)' })
  @ApiResponse({ status: 200, description: 'Certificate removed' })
  async deleteCertificate(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertCourseV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
    const prev = await this.coursesRepository.getCertificate({ expertId, courseId });
    const updated = await this.coursesRepository.clearCertificate({ expertId, courseId });
    if (prev.pdfKey) {
      try {
        await this.storage.deleteObject({ key: prev.pdfKey });
      } catch {
        // best-effort
      }
    }
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.course.certificate.delete',
      entityType: 'course',
      entityId: courseId,
      meta: { expertId },
      traceId: getTraceId(req),
    });
    return updated;
  }

  @Get(':courseId')
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'Get course (support+)' })
  @ApiResponse({ status: 200, description: 'Course' })
  async get(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ExpertCourseV1> {
    const course = await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
    return course;
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

    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });

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
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
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
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
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
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
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

