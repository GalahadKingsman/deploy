import { Body, Controller, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes, ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import { UsersRepository } from '../../users/users.repository.js';
import { StudentCoursesRepository } from '../../student/student_courses.repository.js';
import { EnrollmentsRepository } from '../../student/student_enrollments.repository.js';
import { AssignmentsRepository } from '../../assignments/assignments.repository.js';
import { SubmissionsRepository } from '../../submissions/submissions.repository.js';
import { S3StorageService } from '../../storage/s3-storage.service.js';
import { BotTokenGuard } from './bot-token.guard.js';
import { BotInternalGuard } from './bot-internal.guard.js';

type BotCreateSubmissionRequest = {
  telegramUserId: string;
  lessonId: string;
  text?: string | null;
  link?: string | null;
  telegramFileId?: string | null;
};

@ApiTags('Bot')
@Controller('bot')
@UseGuards(BotTokenGuard, BotInternalGuard)
export class BotSubmissionsController {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly submissionsRepository: SubmissionsRepository,
    private readonly storage: S3StorageService,
  ) {}

  @Post('submissions')
  @ApiOperation({ summary: 'Create submission from Telegram bot (server downloads file and stores in S3)' })
  @ApiResponse({ status: 201, description: 'Submission created' })
  async createSubmissionFromBot(
    @Body() body: BotCreateSubmissionRequest,
  ): Promise<{ submission: ContractsV1.SubmissionV1 }> {
    const telegramUserId = String(body.telegramUserId ?? '').trim();
    const lessonId = String(body.lessonId ?? '').trim();
    if (!telegramUserId || !lessonId) {
      throw new NotFoundException({ code: ErrorCodes.VALIDATION_ERROR, message: 'telegramUserId and lessonId are required' });
    }

    const user = await this.usersRepository.findByTelegramUserId(telegramUserId);
    if (!user) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });
    }

    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    }

    const hasAccess = await this.enrollmentsRepository.hasActiveAccess({ userId: user.id, courseId: lesson.courseId });
    if (!hasAccess) {
      throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });
    }

    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Assignment not found' });
    }

    let fileKey: string | null = null;
    const telegramFileId = body.telegramFileId ? String(body.telegramFileId).trim() : '';
    if (telegramFileId) {
      const env = validateOrThrow(ApiEnvSchema, process.env);
      const token = env.TELEGRAM_BOT_TOKEN;
      const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(telegramFileId)}`);
      const getFileJson = (await getFileRes.json()) as any;
      const filePath = getFileJson?.result?.file_path as string | undefined;
      if (!filePath) {
        throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Telegram file not found' });
      }
      const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) {
        throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Failed to download Telegram file' });
      }
      const bytes = new Uint8Array(await fileRes.arrayBuffer());
      const contentType = fileRes.headers.get('content-type');
      const key = `submissions/${assignment.id}/${user.id}/${Date.now()}-${filePath.split('/').pop() ?? 'file'}`;
      await this.storage.putObject({ key, body: bytes, contentType });
      fileKey = key;
    }

    const submission = await this.submissionsRepository.create({
      assignmentId: assignment.id,
      lessonId,
      studentUserId: user.id,
      text: body.text ?? null,
      link: body.link ?? null,
      fileKey,
    });

    return { submission };
  }
}

