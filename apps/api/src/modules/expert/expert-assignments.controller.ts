import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
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
import { LessonsRepository } from '../../authoring/lessons.repository.js';
import { AssignmentsRepository } from '../../assignments/assignments.repository.js';
import { AssignmentFilesRepository } from '../../assignments/assignment-files.repository.js';
import { S3StorageService } from '../../storage/s3-storage.service.js';

@ApiTags('Expert Assignments')
@Controller('experts/:expertId')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertAssignmentsController {
  constructor(
    private readonly lessonsRepository: LessonsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly assignmentFilesRepository: AssignmentFilesRepository,
    private readonly storage: S3StorageService,
  ) {}

  @Get('lessons/:lessonId/assignment')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'Get assignment for lesson (reviewer+)' })
  @ApiResponse({ status: 200, description: 'Assignment (or null)' })
  async get(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<ContractsV1.GetLessonAssignmentResponseV1> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    const files = assignment
      ? await this.assignmentFilesRepository.listByAssignmentId(assignment.id)
      : [];
    return { assignment, files };
  }

  @Patch('lessons/:lessonId/assignment')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upsert assignment prompt for lesson (manager+)' })
  @ApiResponse({ status: 200, description: 'Assignment upserted' })
  async upsert(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: ContractsV1.UpsertAssignmentRequestV1,
  ): Promise<ContractsV1.AssignmentV1> {
    const parsed = ContractsV1.UpsertAssignmentRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      // Nest filter will map this to standard API error
      throw new Error('Validation failed');
    }
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    return await this.assignmentsRepository.upsertByLessonId({
      lessonId,
      promptMarkdown: parsed.data.promptMarkdown ?? null,
    });
  }

  @Get('lessons/:lessonId/assignment/files')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'List assignment files for lesson (reviewer+)' })
  @ApiResponse({ status: 200, description: 'Files list' })
  async listFiles(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<{ items: ContractsV1.AssignmentFileV1[] }> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) return { items: [] };
    const items = await this.assignmentFilesRepository.listByAssignmentId(assignment.id);
    return { items };
  }

  @Post('lessons/:lessonId/assignment/files/upload')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload assignment material file (multipart, manager+)' })
  @ApiResponse({ status: 201, description: 'File stored and metadata created' })
  async uploadAssignmentFile(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Req()
    req: FastifyRequest & {
      user?: { userId: string };
      file?: (opts?: any) => Promise<any>;
    },
  ): Promise<ContractsV1.AssignmentFileV1> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const assignment = await this.assignmentsRepository.ensureByLessonId(lessonId);

    const file = await (req as any).file?.();
    if (!file) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'file is required' });
    }

    const buf: Buffer = await file.toBuffer();
    if (!buf || buf.length === 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Empty file' });
    }

    const displayName =
      typeof file.filename === 'string' && file.filename.trim() ? file.filename.trim() : 'file';
    const safeName = displayName.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `assignment-files/${assignment.id}/${Date.now()}-${safeName}`;
    await this.storage.putObject({
      key,
      body: new Uint8Array(buf),
      contentType: file.mimetype ?? null,
    });

    return await this.assignmentFilesRepository.create({
      assignmentId: assignment.id,
      fileKey: key,
      filename: displayName,
      contentType: typeof file.mimetype === 'string' && file.mimetype ? file.mimetype : null,
    });
  }

  @Post('lessons/:lessonId/assignment/files/signed')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create signed PUT URL for assignment file upload (manager+)' })
  @ApiResponse({ status: 201, description: 'Signed upload URL' })
  async createSignedUpload(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Body()
    body: {
      filename?: string | null;
      contentType?: string | null;
    },
  ): Promise<{ fileKey: string; url: string }> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const assignment = await this.assignmentsRepository.ensureByLessonId(lessonId);

    const original = typeof body?.filename === 'string' && body.filename ? body.filename : 'file';
    const safeName = original.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `assignment-files/${assignment.id}/${Date.now()}-${safeName}`;
    const rawCt = typeof body?.contentType === 'string' ? body.contentType.trim() : '';
    // Presigned PUT must match the client Content-Type header; browsers often send
    // application/octet-stream when File.type is empty, so never sign with "no type".
    const contentType = rawCt || 'application/octet-stream';
    const signed = await this.storage.getSignedPutUrl({ key, contentType, expiresSeconds: 120 });
    return { fileKey: key, url: signed.url };
  }

  @Post('lessons/:lessonId/assignment/files')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Attach assignment file metadata after upload (manager+)' })
  @ApiResponse({ status: 201, description: 'File created' })
  async attachFile(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Body()
    body: {
      fileKey?: string;
      filename?: string;
      contentType?: string | null;
    },
  ): Promise<ContractsV1.AssignmentFileV1> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const assignment = await this.assignmentsRepository.ensureByLessonId(lessonId);

    const fileKey = typeof body?.fileKey === 'string' ? body.fileKey.trim() : '';
    const filename = typeof body?.filename === 'string' ? body.filename.trim() : '';
    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim() : null;
    if (!fileKey || !filename) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'fileKey and filename are required' });
    }
    if (!fileKey.startsWith(`assignment-files/${assignment.id}/`)) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid fileKey' });
    }
    return await this.assignmentFilesRepository.create({
      assignmentId: assignment.id,
      fileKey,
      filename,
      contentType: contentType || null,
    });
  }

  @Post('lessons/:lessonId/assignment/files/:fileId/delete')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete assignment file metadata (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async deleteFile(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Param('fileId') fileId: string,
  ): Promise<{ ok: true }> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Assignment not found' });
    }
    const file = await this.assignmentFilesRepository.findById(fileId);
    if (!file || file.assignmentId !== assignment.id) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    const ok = await this.assignmentFilesRepository.delete(fileId);
    if (!ok) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    return { ok: true };
  }
}

