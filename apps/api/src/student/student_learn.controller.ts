import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { StudentCoursesRepository } from './student_courses.repository.js';
import type { FastifyRequest } from 'fastify';

@ApiTags('Learn')
@Controller()
export class LearnController {
  constructor(
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly coursesRepository: StudentCoursesRepository,
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

    const lessons = await this.coursesRepository.listLessonsByCourseId(activeCourseId);
    const nextLesson = lessons[0] ?? null;
    return { activeCourse: course, nextLesson };
  }
}

