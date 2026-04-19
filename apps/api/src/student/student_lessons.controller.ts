import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Post,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { ProgressRepository } from './student_progress.repository.js';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyRequest } from 'fastify';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { AssignmentsRepository } from '../assignments/assignments.repository.js';
import { computeCourseLessonAccess } from './student_lesson_access.js';

@ApiTags('Lessons')
@Controller()
export class LessonsController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly progressRepository: ProgressRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
  ) {}

  @Get('lessons/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get lesson by id (student)' })
  @ApiResponse({ status: 200, description: 'Lesson' })
  async getLesson(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.GetLessonResponseV1> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    const lesson = await this.coursesRepository.getLesson(id);
    if (!lesson) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    }
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });
    }
    const access = await computeCourseLessonAccess({
      userId,
      courseId: lesson.courseId,
      coursesRepository: this.coursesRepository,
      progressRepository: this.progressRepository,
    });
    if (!access.unlockedLessonIds.includes(id)) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: 'Lesson is locked. Complete previous lessons first.',
      });
    }
    return { lesson };
  }

  @Post('lessons/:id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark lesson completed (idempotent)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async complete(
    @Param('id') id: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.CompleteLessonResponseV1> {
    const userId = req.user?.userId;
    if (!userId) {
      // JwtAuthGuard should have blocked this
      throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    const lesson = await this.coursesRepository.getLesson(id);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });
    }
    const access = await computeCourseLessonAccess({
      userId,
      courseId: lesson.courseId,
      coursesRepository: this.coursesRepository,
      progressRepository: this.progressRepository,
    });
    if (!access.unlockedLessonIds.includes(id)) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: 'Lesson is locked. Complete previous lessons first.',
      });
    }

    // Manual completion is allowed only when lesson has no assignment.
    const assignment = await this.assignmentsRepository.getByLessonId(id);
    if (assignment) {
      throw new BadRequestException({
        code: ErrorCodes.FORBIDDEN,
        message: 'Lesson has homework. It can be completed only after expert review.',
      });
    }
    await this.progressRepository.markLessonCompleted({ userId, lessonId: id });
    return { ok: true, lessonId: id };
  }
}

