import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyRequest } from 'fastify';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { SubmissionsRepository } from '../submissions/submissions.repository.js';

@ApiTags('Submissions')
@Controller()
export class StudentSubmissionsController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly submissionsRepository: SubmissionsRepository,
  ) {}

  @Get('lessons/:lessonId/submissions/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my submissions for lesson (student)' })
  @ApiResponse({ status: 200, description: 'Submissions list' })
  async listMine(
    @Param('lessonId') lessonId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ListLessonSubmissionsResponseV1> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });
    const items = await this.submissionsRepository.listMyByLesson({ userId, lessonId });
    return { items };
  }
}

