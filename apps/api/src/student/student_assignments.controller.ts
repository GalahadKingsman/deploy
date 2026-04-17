import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
  Req,
  Res,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { AssignmentsRepository } from '../assignments/assignments.repository.js';
import { AssignmentFilesRepository } from '../assignments/assignment-files.repository.js';
import { SubmissionsRepository } from '../submissions/submissions.repository.js';
import { S3StorageService } from '../storage/s3-storage.service.js';

@ApiTags('Assignments')
@Controller()
export class StudentAssignmentsController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly assignmentFilesRepository: AssignmentFilesRepository,
    private readonly submissionsRepository: SubmissionsRepository,
    private readonly storage: S3StorageService,
  ) {}

  @Get('lessons/:lessonId/assignment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get assignment for lesson (student with access)' })
  @ApiResponse({ status: 200, description: 'Assignment (or null)' })
  async getAssignment(
    @Param('lessonId') lessonId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.GetLessonAssignmentResponseV1> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });
    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    const files = assignment
      ? await this.assignmentFilesRepository.listByAssignmentId(assignment.id)
      : [];
    return { assignment, files };
  }

  @Get('lessons/:lessonId/assignment/files/:fileId/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download assignment material file (student with access, proxied from storage)' })
  @ApiResponse({ status: 200, description: 'File stream' })
  async downloadAssignmentFile(
    @Param('lessonId') lessonId: string,
    @Param('fileId') fileId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });

    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Assignment not found' });

    const file = await this.assignmentFilesRepository.findById(fileId);
    if (!file || file.assignmentId !== assignment.id) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    if (!file.fileKey.startsWith('assignment-files/')) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }

    const obj = await this.storage.getObject({ key: file.fileKey });
    if (obj.contentType) reply.header('content-type', obj.contentType);
    if (obj.contentLength != null) reply.header('content-length', String(obj.contentLength));

    const asciiFallback =
      file.filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_').slice(0, 180) || 'file';
    reply.header(
      'content-disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );

    return await reply.send(obj.body as any);
  }

  @Get('lessons/:lessonId/assignment/files/:fileId/signed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get signed URL for assignment file download (student with access)' })
  @ApiResponse({ status: 200, description: 'Signed URL' })
  async getAssignmentFileSignedUrl(
    @Param('lessonId') lessonId: string,
    @Param('fileId') fileId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{ url: string }> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });

    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Assignment not found' });

    const file = await this.assignmentFilesRepository.findById(fileId);
    if (!file || file.assignmentId !== assignment.id) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    if (!file.fileKey.startsWith('assignment-files/')) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    return await this.storage.getSignedGetUrl({ key: file.fileKey, expiresSeconds: 120 });
  }

  @Post('lessons/:lessonId/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create submission for lesson assignment (student)' })
  @ApiResponse({ status: 201, description: 'Created submission' })
  async createSubmission(
    @Param('lessonId') lessonId: string,
    @Body() body: ContractsV1.CreateSubmissionRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.CreateSubmissionResponseV1> {
    const parsed = ContractsV1.CreateSubmissionRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });
    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Assignment not found' });

    const submission = await this.submissionsRepository.create({
      assignmentId: assignment.id,
      lessonId,
      studentUserId: userId,
      text: parsed.data.text ?? null,
      link: parsed.data.link ?? null,
      fileKey: parsed.data.fileKey ?? null,
    });
    return { submission };
  }
}

