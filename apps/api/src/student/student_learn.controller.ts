import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { StudentCoursesRepository } from './student_courses.repository.js';
import type { FastifyRequest } from 'fastify';
import { ProgressRepository } from './student_progress.repository.js';
import { computeCourseLessonAccess } from './student_lesson_access.js';

@ApiTags('Learn')
@Controller()
export class LearnController {
  constructor(
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly progressRepository: ProgressRepository,
  ) {}

  @Get('learn/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Learn summary for current user' })
  @ApiResponse({ status: 200, description: 'Summary' })
  async summary(
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.GetLearnSummaryResponseV1> {
    const userId = req.user?.userId;
    if (!userId) return { activeCourse: null, nextLesson: null };

    const courseIds = await this.enrollmentsRepository.listMyActiveCourseIds(userId);
    const activeCourseId = courseIds[0];
    if (!activeCourseId) return { activeCourse: null, nextLesson: null };

    const course = await this.coursesRepository.getCourse(activeCourseId);
    if (!course) return { activeCourse: null, nextLesson: null };

    const access = await computeCourseLessonAccess({
      userId,
      courseId: activeCourseId,
      coursesRepository: this.coursesRepository,
      progressRepository: this.progressRepository,
    });
    const lessons = await this.coursesRepository.listLessonsByCourseId(activeCourseId);
    const nextLesson =
      (access.nextUnlockedLessonId && lessons.find((l) => l.id === access.nextUnlockedLessonId)) ?? null;
    return { activeCourse: course, nextLesson };
  }
}

