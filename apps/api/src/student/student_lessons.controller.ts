import { Controller, Get, Param, NotFoundException, Post, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { ProgressRepository } from './student_progress.repository.js';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyRequest } from 'fastify';

@ApiTags('Lessons')
@Controller()
export class LessonsController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly progressRepository: ProgressRepository,
  ) {}

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Get lesson by id (student)' })
  @ApiResponse({ status: 200, description: 'Lesson' })
  async getLesson(@Param('id') id: string): Promise<ContractsV1.GetLessonResponseV1> {
    const lesson = await this.coursesRepository.getLesson(id);
    if (!lesson) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
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
    await this.progressRepository.markLessonCompleted({ userId, lessonId: id });
    return { ok: true, lessonId: id };
  }
}

