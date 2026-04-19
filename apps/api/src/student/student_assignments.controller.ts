import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  Post,
  Body,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { ProgressRepository } from './student_progress.repository.js';
import { computeCourseLessonAccess } from './student_lesson_access.js';
import { AssignmentsRepository } from '../assignments/assignments.repository.js';
import { AssignmentFilesRepository } from '../assignments/assignment-files.repository.js';
import { SubmissionsRepository } from '../submissions/submissions.repository.js';
import { S3StorageService } from '../storage/s3-storage.service.js';

@ApiTags('Assignments')
@Controller()
function assignmentPromptHasBody(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  let s = String(raw)
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .trim();
  if (!s) return false;
  const noTags = s.replace(/<[^>]+>/g, ' ');
  const collapsed = noTags.replace(/\s+/g, ' ').trim();
  return collapsed.length > 0;
}

export class StudentAssignmentsController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly progressRepository: ProgressRepository,
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

  @Get('me/homework/next-pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Latest “received” homework that still needs the student’s send (unlocked lesson, no submission or rework; excludes submitted/accepted)',
  })
  @ApiResponse({ status: 200, description: 'Homework context or null' })
  async getNextPendingHomework(
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.GetNextPendingHomeworkResponseV1> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });

    const courseIds = await this.enrollmentsRepository.listMyActiveCourseIds(userId);
    type Best = {
      updatedAtMs: number;
      courseIdx: number;
      lessonIdx: number;
      payload: ContractsV1.NextPendingHomeworkV1;
    };
    let best: Best | null = null;

    for (let ci = 0; ci < courseIds.length; ci++) {
      const courseId = courseIds[ci];
      const access = await computeCourseLessonAccess({
        userId,
        courseId,
        coursesRepository: this.coursesRepository,
        progressRepository: this.progressRepository,
      });
      const unlocked = new Set(access.unlockedLessonIds);
      const lessons = await this.coursesRepository.listLessonsByCourseId(courseId);
      for (let li = 0; li < lessons.length; li++) {
        const lesson = lessons[li];
        if (!unlocked.has(lesson.id)) continue;
        const assignment = await this.assignmentsRepository.getByLessonId(lesson.id);
        if (!assignment) continue;
        const files = await this.assignmentFilesRepository.listByAssignmentId(assignment.id);
        const hasBody = assignmentPromptHasBody(assignment.promptMarkdown);
        if (!hasBody && files.length === 0) continue;

        const subs = await this.submissionsRepository.listMyByLesson({ userId, lessonId: lesson.id });
        const latestStatus = subs[0]?.status;
        if (latestStatus === 'submitted' || latestStatus === 'accepted') continue;

        const ctx = await this.coursesRepository.getLessonWithContext(lesson.id);
        if (!ctx) continue;

        const updatedAtMs = new Date(assignment.updatedAt).getTime();
        const payload: ContractsV1.NextPendingHomeworkV1 = {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          courseTitle: ctx.courseTitle,
          moduleTitle: ctx.moduleTitle,
          promptMarkdown: assignment.promptMarkdown ?? null,
          hasExpertFiles: files.length > 0,
        };
        const cand: Best = { updatedAtMs, courseIdx: ci, lessonIdx: li, payload };
        if (
          !best ||
          cand.updatedAtMs > best.updatedAtMs ||
          (cand.updatedAtMs === best.updatedAtMs &&
            (cand.courseIdx < best.courseIdx || (cand.courseIdx === best.courseIdx && cand.lessonIdx < best.lessonIdx)))
        ) {
          best = cand;
        }
      }
    }

    return { homework: best?.payload ?? null };
  }

  @Get('lessons/:lessonId/assignment/files/:fileId/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Download assignment material file (student with access, proxied from storage). Use ?inline=1 for browser preview (real Content-Type + inline disposition); omit for attachment (Telegram WebApp).',
  })
  @ApiResponse({ status: 200, description: 'File stream' })
  async downloadAssignmentFile(
    @Param('lessonId') lessonId: string,
    @Param('fileId') fileId: string,
    @Query('inline') inline: string | undefined,
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
    const asciiFallback =
      file.filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_').slice(0, 180) || 'file';
    const wantInline = inline === '1' || inline === 'true';

    if (wantInline) {
      const ct = (obj.contentType ?? '').trim() || 'application/octet-stream';
      reply.header('content-type', ct);
      reply.header('x-content-type-options', 'nosniff');
      if (obj.contentLength != null) reply.header('content-length', String(obj.contentLength));
      reply.header(
        'content-disposition',
        `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      );
    } else {
      // Force octet-stream so iOS / Telegram WebView do not open PDF/images inline (breaks WebApp "Назад").
      reply.header('content-type', 'application/octet-stream');
      reply.header('x-content-type-options', 'nosniff');
      if (obj.contentLength != null) reply.header('content-length', String(obj.contentLength));
      reply.header(
        'content-disposition',
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      );
    }

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

    const mySubmissions = await this.submissionsRepository.listMyByLesson({ userId, lessonId });
    const latest = mySubmissions[0];
    if (latest?.status === 'accepted') {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: 'Ответ уже принят экспертом; изменить отправленные материалы нельзя',
      });
    }

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

