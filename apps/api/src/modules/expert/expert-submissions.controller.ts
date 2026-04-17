import {
  Body,
  Controller,
  Get,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { LessonsRepository } from '../../authoring/lessons.repository.js';
import { AssignmentsRepository } from '../../assignments/assignments.repository.js';
import { SubmissionsRepository } from '../../submissions/submissions.repository.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { S3StorageService } from '../../storage/s3-storage.service.js';
import { UsersRepository } from '../../users/users.repository.js';
import { TelegramOutboundService } from '../../integrations/telegram-outbound.service.js';

@ApiTags('Expert Submissions')
@Controller('experts/:expertId')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertSubmissionsController {
  constructor(
    private readonly lessonsRepository: LessonsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly submissionsRepository: SubmissionsRepository,
    private readonly storage: S3StorageService,
    private readonly usersRepository: UsersRepository,
    private readonly telegramOutbound: TelegramOutboundService,
  ) {}

  @Get('lessons/:lessonId/submissions')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'List submissions for lesson assignment (reviewer+)' })
  @ApiResponse({ status: 200, description: 'Submissions list' })
  async list(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<ContractsV1.ListLessonSubmissionsResponseV1> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) return { items: [] };
    const items = await this.submissionsRepository.listByAssignmentId({
      assignmentId: assignment.id,
      lessonId,
    });
    return { items };
  }

  @Patch('lessons/:lessonId/submissions/:submissionId')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'Decide submission status (reviewer+)' })
  @ApiResponse({ status: 200, description: 'Submission updated' })
  async decide(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: ContractsV1.DecideSubmissionRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.CreateSubmissionResponseV1> {
    const parsed = ContractsV1.DecideSubmissionRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const scoreProvided = body != null && typeof body === 'object' && 'score' in (body as any);
    const reviewerCommentProvided =
      body != null && typeof body === 'object' && 'reviewerComment' in (body as any);
    const updated = await this.submissionsRepository.decide({
      submissionId,
      status: parsed.data.status,
      decidedByUserId: req.user?.userId ?? null,
      lessonId,
      scoreProvided,
      score: parsed.data.score ?? null,
      reviewerCommentProvided,
      reviewerComment: parsed.data.reviewerComment ?? null,
    });
    if (!updated) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Submission not found' });
    }
    const student = await this.usersRepository.findById(updated.studentId);
    const lessonTitle =
      (await this.lessonsRepository.getTitleForExpertLesson({ expertId, lessonId })) ?? lessonId;
    if (student?.telegramUserId) {
      const statusRu =
        parsed.data.status === 'accepted'
          ? 'принято'
          : parsed.data.status === 'rework'
            ? 'нужны доработки'
            : parsed.data.status;
      await this.telegramOutbound.sendMessageToUser(
        student.telegramUserId,
        `Домашнее задание по уроку «${lessonTitle}»: ${statusRu}.`,
      );
    }
    return { submission: updated };
  }

  @Get('lessons/:lessonId/submissions/:submissionId/file')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'Download submission file (reviewer+)' })
  @ApiResponse({ status: 200, description: 'File stream' })
  async downloadFile(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Param('submissionId') submissionId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const s = await this.submissionsRepository.findForDownload(submissionId);
    if (!s || s.lessonId !== lessonId) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Submission not found' });
    }
    if (!s.fileKey) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    if (!s.fileKey.startsWith('submissions/')) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Forbidden' });
    }

    const obj = await this.storage.getObject({ key: s.fileKey });
    const lastSeg = s.fileKey.includes('/') ? s.fileKey.slice(s.fileKey.lastIndexOf('/') + 1) : s.fileKey;
    const asciiName = lastSeg.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_').slice(0, 180) || 'file';
    reply.header('content-type', 'application/octet-stream');
    reply.header('x-content-type-options', 'nosniff');
    reply.header(
      'content-disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(lastSeg)}`,
    );
    if (obj.contentLength != null) reply.header('content-length', String(obj.contentLength));
    return await reply.send(obj.body as any);
  }

  @Get('lessons/:lessonId/submissions/:submissionId/file/signed')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'Get signed URL for submission file (reviewer+)' })
  @ApiResponse({ status: 200, description: 'Signed URL' })
  async getSignedFileUrl(
    @Param('expertId') expertId: string,
    @Param('lessonId') lessonId: string,
    @Param('submissionId') submissionId: string,
  ): Promise<{ url: string }> {
    await this.lessonsRepository.assertLessonBelongsToExpert({ expertId, lessonId });
    const s = await this.submissionsRepository.findForDownload(submissionId);
    if (!s || s.lessonId !== lessonId) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Submission not found' });
    }
    if (!s.fileKey) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    if (!s.fileKey.startsWith('submissions/')) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Forbidden' });
    }
    return await this.storage.getSignedGetUrl({ key: s.fileKey, expiresSeconds: 120 });
  }
}

