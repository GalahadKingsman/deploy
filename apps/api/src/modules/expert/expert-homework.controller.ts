import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { SubmissionsRepository } from '../../submissions/submissions.repository.js';
import { AssignmentsRepository } from '../../assignments/assignments.repository.js';
import { LessonsRepository } from '../../authoring/lessons.repository.js';
import { ExpertCourseAccessService } from './expert-course-access.service.js';

@ApiTags('Expert Homework')
@Controller('experts/:expertId/homework')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertHomeworkController {
  constructor(
    private readonly submissionsRepository: SubmissionsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly lessonsRepository: LessonsRepository,
    private readonly expertCourseAccessService: ExpertCourseAccessService,
  ) {}

  @Get('inbox')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'Homework inbox for expert (reviewer only)' })
  @ApiQuery({ name: 'filter', required: false, enum: ['all', 'new', 'checked', 'unchecked'] })
  @ApiResponse({ status: 200, description: 'Inbox list' })
  async inbox(
    @Param('expertId') expertId: string,
    @Query('filter') filterRaw: string | undefined,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{
    items: Array<{
      submissionId: string;
      lessonId: string;
      assignmentId: string;
      studentId: string;
      createdAt: string;
      studentFirstName: string | null;
      studentLastName: string | null;
      studentUsername: string | null;
      studentEmail: string | null;
      studentAvatarUrl: string | null;
      courseTitle: string;
      moduleTitle: string;
      lessonTitle: string;
      answerPreview: string;
      submissionStatus: ContractsV1.SubmissionStatusV1;
      isOpened: boolean;
      uiStatus: 'new' | 'unchecked' | 'checked';
    }>;
  }> {
    const filter = (filterRaw ?? '').trim() as 'all' | 'new' | 'checked' | 'unchecked' | '';
    const f: 'all' | 'new' | 'checked' | 'unchecked' = (['all', 'new', 'checked', 'unchecked'] as const).includes(
      filter as any,
    )
      ? (filter as any)
      : 'all';

    const items = await this.submissionsRepository.listExpertHomeworkInbox({
      expertId,
      reviewerUserId: req.user!.userId,
      filter: f,
      limit: 200,
    });
    return { items };
  }

  @Get('pending-count')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'Count homework items that need action (new + not yet checked, i.e. not accepted)' })
  @ApiResponse({ status: 200, description: '{ count: number }' })
  async pendingCount(@Param('expertId') expertId: string): Promise<{ count: number }> {
    const count = await this.submissionsRepository.countExpertHomeworkPendingInboxForExpert(expertId);
    return { count };
  }

  @Get('submissions/:submissionId')
  @RequireExpertRole('reviewer')
  @ApiOperation({ summary: 'Homework detail (marks opened)' })
  @ApiResponse({ status: 200, description: 'Detail' })
  async detail(
    @Param('expertId') expertId: string,
    @Param('submissionId') submissionId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{
    submission: ContractsV1.SubmissionV1;
    assignmentPromptMarkdown: string | null;
    courseTitle: string;
    moduleTitle: string;
    lessonTitle: string;
    student: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      email: string | null;
      avatarUrl: string | null;
    };
  }> {
    const d = await this.submissionsRepository.getExpertHomeworkDetailAndMarkOpened({
      expertId,
      reviewerUserId: req.user!.userId,
      submissionId,
    });
    if (!d) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Submission not found' });
    }

    // Extra guard: verify that lesson belongs to expert and reviewer has access to course
    await this.expertCourseAccessService.assertCanAccessLesson({
      expertId,
      userId: req.user!.userId,
      lessonId: d.submission.lessonId,
    });

    // Load prompt markdown (assignment is 1:1 per lesson)
    const assignment = await this.assignmentsRepository.getByLessonId(d.submission.lessonId);
    const prompt = assignment?.promptMarkdown ?? null;

    // Ensure lesson title is consistent with expert scope if needed
    const lt =
      (await this.lessonsRepository.getTitleForExpertLesson({ expertId, lessonId: d.submission.lessonId })) ??
      d.lessonTitle;

    return {
      submission: d.submission,
      assignmentPromptMarkdown: prompt,
      courseTitle: d.courseTitle,
      moduleTitle: d.moduleTitle,
      lessonTitle: lt,
      student: d.student,
    };
  }
}

