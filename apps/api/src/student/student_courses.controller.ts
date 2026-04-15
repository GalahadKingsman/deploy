import { Controller, Get, Param, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { StudentCoursesRepository } from './student_courses.repository.js';
import type { FastifyRequest } from 'fastify';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { OptionalJwtAuthGuard } from '../auth/session/optional-jwt-auth.guard.js';

@ApiTags('Courses')
@Controller()
export class CoursesController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
  ) {}

  @Get('courses/:id')
  @ApiOperation({ summary: 'Get course by id (student)' })
  @ApiResponse({ status: 200, description: 'Course + lessons' })
  @UseGuards(OptionalJwtAuthGuard)
  async getCourse(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user?: { userId?: string } },
  ): Promise<ContractsV1.GetCourseResponseV1> {
    const course = await this.coursesRepository.getCourse(id);
    if (!course) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not found' });
    }

    const userId = req.user?.userId ?? null;
    if (!userId) {
      return { course, lessons: [] };
    }

    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: id });
    if (!ok) {
      return { course, lessons: [] };
    }

    const lessons = await this.coursesRepository.listLessonsByCourseId(id);
    return { course, lessons };
  }
}

