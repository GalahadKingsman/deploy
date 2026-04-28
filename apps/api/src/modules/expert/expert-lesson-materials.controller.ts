import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { ExpertCourseAccessService } from './expert-course-access.service.js';
import { LessonMaterialFilesRepository } from '../../authoring/lesson-material-files.repository.js';
import { S3StorageService } from '../../storage/s3-storage.service.js';

@ApiTags('Expert Lesson Materials')
@Controller('experts/:expertId/lessons/:lessonId/materials')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertLessonMaterialsController {
  constructor(
    private readonly expertCourseAccessService: ExpertCourseAccessService,
    private readonly lessonMaterialFilesRepository: LessonMaterialFilesRepository,
    private readonly storage: S3StorageService,
  ) {}

  @Get()
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'List lesson materials files (reviewer+)' })
  @ApiResponse({ status: 200, description: 'Files list' })
  async list(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ListLessonMaterialsResponseV1> {
    await this.expertCourseAccessService.assertCanAccessLesson({
      expertId,
      userId: req.user!.userId,
      lessonId,
    });
    const items = await this.lessonMaterialFilesRepository.listByLessonId(lessonId);
    return { items };
  }

  @Post('upload')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload lesson material file (multipart, manager+)' })
  @ApiResponse({ status: 201, description: 'File stored and metadata created' })
  async upload(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Req()
    req: FastifyRequest & {
      user?: { userId: string };
      file?: (opts?: any) => Promise<any>;
    },
  ): Promise<ContractsV1.LessonMaterialFileV1> {
    await this.expertCourseAccessService.assertCanAccessLesson({
      expertId,
      userId: req.user!.userId,
      lessonId,
    });

    const file = await (req as any).file?.();
    if (!file) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'file is required' });
    }
    const buf = await file.toBuffer();
    if (!buf || buf.length === 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Empty file' });
    }

    const displayName =
      typeof file.filename === 'string' && file.filename.trim() ? file.filename.trim() : 'file';
    const safeName = displayName.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `lesson-materials/${lessonId}/${Date.now()}-${safeName}`;

    await this.storage.putObject({
      key,
      body: new Uint8Array(buf),
      contentType: file.mimetype ?? null,
    });

    return await this.lessonMaterialFilesRepository.create({
      lessonId,
      fileKey: key,
      filename: displayName,
      contentType: typeof file.mimetype === 'string' && file.mimetype ? file.mimetype : null,
      sizeBytes: buf.length,
    });
  }

  @Post(':fileId/delete')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete lesson material file metadata (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async delete(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Param('fileId') fileId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{ ok: true }> {
    await this.expertCourseAccessService.assertCanAccessLesson({
      expertId,
      userId: req.user!.userId,
      lessonId,
    });
    const file = await this.lessonMaterialFilesRepository.findById(fileId);
    if (!file || file.lessonId !== lessonId) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    await this.lessonMaterialFilesRepository.delete(fileId);
    return { ok: true };
  }
}

