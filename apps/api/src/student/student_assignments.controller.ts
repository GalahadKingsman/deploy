import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
  Req,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyRequest } from 'fastify';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { AssignmentsRepository } from '../assignments/assignments.repository.js';
import { SubmissionsRepository } from '../submissions/submissions.repository.js';

@ApiTags('Assignments')
@Controller()
export class StudentAssignmentsController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly submissionsRepository: SubmissionsRepository,
  ) {}

  @Get('lessons/:lessonId/assignment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get assignment for lesson (student with access)' })
  @ApiResponse({ status: 200, description: 'Assignment (or null)' })
  async getAssignment(
    @Param('lessonId') lessonId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.GetLessonAssignmentResponseV1> {
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });
    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    return { assignment };
  }

  @Post('lessons/:lessonId/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create submission for lesson assignment (student)' })
  @ApiResponse({ status: 201, description: 'Created submission' })
  async createSubmission(
    @Param('lessonId') lessonId: string,
    @Body() body: ContractsV1.CreateSubmissionRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.CreateSubmissionResponseV1> {
    const parsed = ContractsV1.CreateSubmissionRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' });
    }
    const userId = req.user?.userId;
    if (!userId) throw new NotFoundException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    const lesson = await this.coursesRepository.getLesson(lessonId);
    if (!lesson) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Lesson not found' });
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId: lesson.courseId });
    if (!ok) throw new NotFoundException({ code: ErrorCodes.FORBIDDEN, message: 'No active access to this course' });
    const assignment = await this.assignmentsRepository.getByLessonId(lessonId);
    if (!assignment) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Assignment not found' });

    const submission = await this.submissionsRepository.create({
      assignmentId: assignment.id,
      lessonId,
      studentUserId: userId,
      text: parsed.data.text ?? null,
      link: parsed.data.link ?? null,
      fileKey: parsed.data.fileKey ?? null,
    });
    return { submission };
  }
}

