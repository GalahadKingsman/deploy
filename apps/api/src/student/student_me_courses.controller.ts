import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyRequest } from 'fastify';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { ProgressRepository } from './student_progress.repository.js';

@ApiTags('User')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeCoursesController {
  constructor(
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly progressRepository: ProgressRepository,
  ) {}

  @Get('me/courses')
  @ApiOperation({ summary: 'List my courses (enrolled)' })
  @ApiResponse({ status: 200, description: 'Courses list' })
  async list(
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.MeCoursesResponseV1> {
    const userId = req.user?.userId;
    if (!userId) return { items: [] };

    const courseIds = await this.enrollmentsRepository.listMyActiveCourseIds(userId);
    const items: ContractsV1.MyCourseProgressV1[] = [];

    for (const courseId of courseIds) {
      const course = await this.coursesRepository.getCourse(courseId);
      if (!course) continue;
      const total = await this.progressRepository.countLessonsInCourse(courseId);
      const done = await this.progressRepository.countCompletedByCourse({ userId, courseId });
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      items.push({ course, doneLessons: done, totalLessons: total, progressPercent: pct });
    }

    return { items };
  }
}

