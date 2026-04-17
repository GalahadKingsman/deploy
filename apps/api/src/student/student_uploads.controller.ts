import {
  BadRequestException,
  Controller,
  NotFoundException,
  Post,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyRequest } from 'fastify';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { AssignmentsRepository } from '../assignments/assignments.repository.js';
import { S3StorageService } from '../storage/s3-storage.service.js';

@ApiTags('Uploads')
@Controller()
export class StudentUploadsController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly storage: S3StorageService,
  ) {}

  @Post('uploads/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload file for submission (student with access)' })
  @ApiResponse({ status: 201, description: 'Uploaded' })
  async uploadSubmissionFile(
    @Req() req: FastifyRequest & {
      user?: { userId: string };
      file?: (opts?: any) => Promise<any>;
    },
  ): Promise<{ fileKey: string }> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });

    // Parse multipart file and fields
    const file = await (req as any).file?.();
    if (!file) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'file is required' });
    }

    const lessonIdRaw = file?.fields?.lessonId?.value;
    const lessonId = typeof lessonIdRaw === 'string' ? lessonIdRaw.trim() : '';
    if (!lessonId) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'lessonId is required' });
    }

    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });

    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Assignment not found' });

    const buf: Buffer = await file.toBuffer();
    if (!buf || buf.length === 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Empty file' });
    }

    const original = typeof file.filename === 'string' && file.filename ? file.filename : 'file';
    const safeName = original.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `submissions/${assignment.id}/${userId}/${Date.now()}-${safeName}`;
    await this.storage.putObject({
      key,
      body: new Uint8Array(buf),
      contentType: file.mimetype ?? null,
    });

    return { fileKey: key };
  }

  @Post('uploads/submissions/signed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get signed PUT URL for submission file upload (student with access)' })
  @ApiResponse({ status: 201, description: 'Signed upload URL' })
  async createSignedSubmissionUpload(
    @Body()
    body: {
      lessonId?: string;
      filename?: string | null;
      contentType?: string | null;
    },
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{ fileKey: string; url: string }> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });

    const lessonId = typeof body?.lessonId === 'string' ? body.lessonId.trim() : '';
    if (!lessonId) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'lessonId is required' });
    }

    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });

    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Assignment not found' });

    const original = typeof body?.filename === 'string' && body.filename ? body.filename : 'file';
    const safeName = original.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `submissions/${assignment.id}/${userId}/${Date.now()}-${safeName}`;

    const rawCt = typeof body?.contentType === 'string' ? body.contentType.trim() : '';
    const contentType = rawCt || 'application/octet-stream';
    const signed = await this.storage.getSignedPutUrl({ key, contentType, expiresSeconds: 120 });
    return { fileKey: key, url: signed.url };
  }
}

