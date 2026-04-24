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
import { ContractsV1, ErrorCodes, normalizeRutubeEmbedUrl } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { LessonsRepository } from '../../authoring/lessons.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import type { FastifyRequest } from 'fastify';
import { ExpertCourseAccessService } from './expert-course-access.service.js';
import { S3StorageService } from '../../storage/s3-storage.service.js';

function normalizeRutubeInVideo(
  v: ContractsV1.LessonVideoV1 | undefined | null,
): ContractsV1.LessonVideoV1 | undefined | null {
  if (v == null) return v;
  if (v.kind !== 'rutube') return v;
  const url = normalizeRutubeEmbedUrl(v.url);
  if (!url) {
    throw new BadRequestException({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid Rutube video URL',
    });
  }
  return { kind: 'rutube', url };
}

function getTraceId(req: FastifyRequest & { traceId?: string }): string | null {
  const h = req.headers?.['x-request-id'];
  return req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;
}

@ApiTags('Expert Lessons')
@Controller('experts/:expertId/modules/:moduleId/lessons')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertLessonsController {
  constructor(
    private readonly lessonsRepository: LessonsRepository,
    private readonly auditService: AuditService,
    private readonly expertCourseAccessService: ExpertCourseAccessService,
    private readonly storage: S3StorageService,
  ) {}

  @Get()
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'List lessons by module (support+)' })
  @ApiResponse({ status: 200, description: 'Lessons list' })
  async list(
    @Param('expertId') expertId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ListExpertLessonsResponseV1> {
    await this.expertCourseAccessService.assertCanAccessModule({
      expertId,
      userId: req.user!.userId,
      moduleId,
    });
    const items = await this.lessonsRepository.listByModuleId(moduleId);
    return { items };
  }

  @Post()
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create lesson (manager+)' })
  @ApiResponse({ status: 201, description: 'Lesson created' })
  async create(
    @Param('expertId') expertId: string,
    @Param('moduleId') moduleId: string,
    @Body() body: ContractsV1.CreateExpertLessonRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertLessonV1> {
    await this.expertCourseAccessService.assertCanAccessModule({
      expertId,
      userId: req.user!.userId,
      moduleId,
    });
    const parsed = ContractsV1.CreateExpertLessonRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    const created = await this.lessonsRepository.create({
      id: randomUUID(),
      moduleId,
      title: parsed.data.title,
      contentMarkdown: parsed.data.contentMarkdown ?? null,
      slider: parsed.data.slider ?? null,
      video: normalizeRutubeInVideo(parsed.data.video) ?? undefined,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.lesson.create',
      entityType: 'lesson',
      entityId: created.id,
      meta: { expertId, moduleId, title: created.title },
      traceId: getTraceId(req),
    });
    return created;
  }

  @Patch(':lessonId')
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'Update lesson (manager+)' })
  @ApiResponse({ status: 200, description: 'Lesson updated' })
  async update(
    @Param('expertId') expertId: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: ContractsV1.UpdateExpertLessonRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertLessonV1> {
    await this.expertCourseAccessService.assertCanAccessModule({
      expertId,
      userId: req.user!.userId,
      moduleId,
    });
    const parsed = ContractsV1.UpdateExpertLessonRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    const patch = { ...parsed.data };
    if (patch.video !== undefined) {
      patch.video = normalizeRutubeInVideo(patch.video) ?? undefined;
    }
    const updated = await this.lessonsRepository.update({
      moduleId,
      lessonId,
      patch,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.lesson.update',
      entityType: 'lesson',
      entityId: updated.id,
      meta: { expertId, moduleId },
      traceId: getTraceId(req),
    });
    return updated;
  }

  @Post(':lessonId/slider/upload')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload slider image (multipart, manager+)' })
  @ApiResponse({ status: 201, description: 'Image stored' })
  async uploadSliderImage(
    @Param('expertId') expertId: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @Req()
    req: FastifyRequest & {
      user?: { userId: string };
      file?: (opts?: any) => Promise<any>;
    },
  ): Promise<{ key: string }> {
    await this.expertCourseAccessService.assertCanAccessLesson({
      expertId,
      userId: req.user!.userId,
      lessonId,
    });

    // Ensure lesson belongs to module as well (defense-in-depth)
    const current = await this.lessonsRepository.listByModuleId(moduleId);
    if (!current.some((x) => x.id === lessonId)) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid lessonId for module' });
    }

    const file = await (req as any).file?.();
    if (!file) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'file is required' });
    }

    const mt = typeof file.mimetype === 'string' ? file.mimetype.trim() : '';
    if (!mt.startsWith('image/')) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Only images are allowed' });
    }

    const buf: Buffer = await file.toBuffer();
    if (!buf || buf.length === 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Empty file' });
    }

    const original = typeof file.filename === 'string' && file.filename.trim() ? file.filename.trim() : 'image';
    const safeName = original.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `lesson-media/${lessonId}/${Date.now()}-${safeName}`;
    await this.storage.putObject({
      key,
      body: new Uint8Array(buf),
      contentType: mt || null,
    });

    return { key };
  }

  @Post('reorder')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder lessons (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async reorder(
    @Param('expertId') expertId: string,
    @Param('moduleId') moduleId: string,
    @Body() body: ContractsV1.ReorderExpertLessonsRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true }> {
    await this.expertCourseAccessService.assertCanAccessModule({
      expertId,
      userId: req.user!.userId,
      moduleId,
    });
    const parsed = ContractsV1.ReorderExpertLessonsRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    await this.lessonsRepository.reorder({ moduleId, items: parsed.data.items });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.lesson.reorder',
      entityType: 'module',
      entityId: moduleId,
      meta: { expertId, moduleId, count: parsed.data.items.length },
      traceId: getTraceId(req),
    });
    return { ok: true };
  }

  @Delete(':lessonId')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete lesson (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async remove(
    @Param('expertId') expertId: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true }> {
    await this.expertCourseAccessService.assertCanAccessModule({
      expertId,
      userId: req.user!.userId,
      moduleId,
    });
    await this.lessonsRepository.softDelete({ moduleId, lessonId });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.lesson.delete',
      entityType: 'lesson',
      entityId: lessonId,
      meta: { expertId, moduleId },
      traceId: getTraceId(req),
    });
    return { ok: true };
  }

}
