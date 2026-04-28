import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { LessonMaterialFilesRepository } from '../authoring/lesson-material-files.repository.js';

@ApiTags('Lessons')
@Controller()
export class StudentLessonMaterialsController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly lessonMaterialFilesRepository: LessonMaterialFilesRepository,
  ) {}

  @Get('lessons/:lessonId/materials')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List lesson materials (student with access)' })
  @ApiResponse({ status: 200, description: 'Files list' })
  async list(
    @Param('lessonId') lessonId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ListLessonMaterialsResponseV1> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });

    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });

    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });

    const items = await this.lessonMaterialFilesRepository.listByLessonId(lessonId);
    return { items };
  }
}

