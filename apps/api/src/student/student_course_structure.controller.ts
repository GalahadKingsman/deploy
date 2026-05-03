import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { OptionalJwtAuthGuard } from '../auth/session/optional-jwt-auth.guard.js';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import { StudentCoursesRepository } from './student_courses.repository.js';
import { EnrollmentsRepository } from './student_enrollments.repository.js';
import { CourseModulesRepository } from '../authoring/course-modules.repository.js';
import { ProgressRepository } from './student_progress.repository.js';
import { AttestationsRepository } from '../authoring/attestations.repository.js';
import { computeCourseLessonAccess } from './student_lesson_access.js';

@ApiTags('Course Structure')
@Controller()
export class StudentCourseStructureController {
  constructor(
    private readonly coursesRepository: StudentCoursesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly modulesRepository: CourseModulesRepository,
    private readonly progressRepository: ProgressRepository,
    private readonly attestationsRepository: AttestationsRepository,
  ) {}

  @Get('courses/:id/modules')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List course modules (public; lessons require enrollment)' })
  @ApiResponse({ status: 200, description: 'Modules' })
  async listModules(@Param('id') id: string): Promise<ContractsV1.ListExpertCourseModulesResponseV1> {
    const course = await this.coursesRepository.getCourse(id);
    if (!course) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not found' });
    const items = await this.modulesRepository.listByCourseId(id);
    return { items };
  }

  @Get('courses/:courseId/modules/:moduleId/lessons')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List module lessons (enrolled only; otherwise empty)' })
  @ApiResponse({ status: 200, description: 'Lessons + module attestations' })
  async listModuleLessons(
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: FastifyRequest & { user?: { userId?: string } },
  ): Promise<ContractsV1.ListModuleLessonsResponseV1> {
    const course = await this.coursesRepository.getCourse(courseId);
    if (!course) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not found' });

    const userId = req.user?.userId ?? null;
    if (!userId)
      return { items: [], unlockedLessonIds: [], completedLessonIds: [], attestations: [] };
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId });
    if (!ok)
      return { items: [], unlockedLessonIds: [], completedLessonIds: [], attestations: [] };

    const items = await this.coursesRepository.listLessonsByModuleId({ courseId, moduleId });
    const access = await computeCourseLessonAccess({
      userId,
      courseId,
      coursesRepository: this.coursesRepository,
      progressRepository: this.progressRepository,
    });
    const lessonIds = new Set(items.map((x) => x.id));
    const allAttestations = await this.attestationsRepository.listForStudentTree({ courseId, userId });
    const moduleAttestations = allAttestations.filter((a) => a.moduleId === moduleId);
    return {
      items,
      unlockedLessonIds: access.unlockedLessonIds.filter((id) => lessonIds.has(id)),
      completedLessonIds: access.completedLessonIds.filter((id) => lessonIds.has(id)),
      attestations: moduleAttestations,
    };
  }

  @Get('courses/:courseId/attestations/course-level')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List course-level attestations (enrolled only)' })
  @ApiResponse({ status: 200, description: 'Attestations' })
  async listCourseLevelAttestations(
    @Param('courseId') courseId: string,
    @Req() req: FastifyRequest & { user?: { userId?: string } },
  ): Promise<ContractsV1.ListStudentCourseAttestationsResponseV1> {
    const course = await this.coursesRepository.getCourse(courseId);
    if (!course) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not found' });
    const userId = req.user?.userId ?? null;
    if (!userId) return { items: [] };
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId });
    if (!ok) return { items: [] };
    const all = await this.attestationsRepository.listForStudentTree({ courseId, userId });
    return { items: all.filter((a) => a.scope === 'course') };
  }

  @Get('courses/:courseId/attestations/:attestationId/for-attempt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get attestation questions for a new attempt (enrolled only)' })
  @ApiResponse({ status: 200, description: 'Questions + options (without correct flag)' })
  async getForAttempt(
    @Param('courseId') courseId: string,
    @Param('attestationId') attestationId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.GetStudentAttestationForAttemptResponseV1> {
    const userId = req.user!.userId;
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId });
    if (!ok) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not available' });
    }
    const ctx = await this.attestationsRepository.getContext(attestationId);
    if (ctx.attestation.course_id !== courseId) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Attestation does not belong to this course',
      });
    }
    const expert = await this.attestationsRepository.getById(attestationId);
    const latest = await this.attestationsRepository.getStudentAttempt({ attestationId, userId });
    return {
      id: expert.id,
      courseId: expert.courseId,
      moduleId: expert.moduleId,
      scope: expert.scope,
      displayTitle: expert.displayTitle,
      questions: expert.questions.map((q) => ({
        id: q.id,
        position: q.position,
        prompt: q.prompt,
        options: q.options.map((o) => ({ id: o.id, position: o.position, label: o.label })),
      })),
      latestAttempt: latest.attempt ? this.attestationsRepository.attemptToSummary(latest.attempt) : null,
    };
  }

  @Post('courses/:courseId/attestations/:attestationId/attempts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit attestation attempt (enrolled only)' })
  @ApiResponse({ status: 201, description: 'Attempt persisted; review payload returned' })
  async submitAttempt(
    @Param('courseId') courseId: string,
    @Param('attestationId') attestationId: string,
    @Body() body: ContractsV1.SubmitStudentAttestationRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.SubmitStudentAttestationResponseV1> {
    const userId = req.user!.userId;
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId });
    if (!ok) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not available' });
    }
    const parsed = ContractsV1.SubmitStudentAttestationRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    const ctx = await this.attestationsRepository.getContext(attestationId);
    if (ctx.attestation.course_id !== courseId) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Attestation does not belong to this course',
      });
    }
    const expert = await this.attestationsRepository.getById(attestationId);
    const expectedQs = new Set(expert.questions.map((q) => q.id));
    if (expert.questions.length === 0) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Attestation has no questions',
      });
    }
    for (const q of expert.questions) {
      const chosen = parsed.data.answers[q.id];
      if (typeof chosen !== 'string' || chosen.length === 0) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Each question must be answered',
        });
      }
      const validOption = q.options.some((o) => o.id === chosen);
      if (!validOption) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Chosen option does not belong to question',
        });
      }
    }
    for (const k of Object.keys(parsed.data.answers)) {
      if (!expectedQs.has(k)) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Unknown question id in answers',
        });
      }
    }
    const result = await this.attestationsRepository.submitAttempt({
      attestationId,
      userId,
      answers: parsed.data.answers,
    });
    return {
      attempt: this.attestationsRepository.attemptToSummary(result.attempt),
      questions: result.questions,
    };
  }

  @Get('courses/:courseId/attestations/:attestationId/review')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get latest attempt review (enrolled only)' })
  @ApiResponse({ status: 200, description: 'Review (chosen + correct option ids)' })
  async getReview(
    @Param('courseId') courseId: string,
    @Param('attestationId') attestationId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.GetStudentAttestationReviewResponseV1> {
    const userId = req.user!.userId;
    const ok = await this.enrollmentsRepository.hasActiveAccess({ userId, courseId });
    if (!ok) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Course not available' });
    }
    const ctx = await this.attestationsRepository.getContext(attestationId);
    if (ctx.attestation.course_id !== courseId) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Attestation does not belong to this course',
      });
    }
    const expert = await this.attestationsRepository.getById(attestationId);
    const latest = await this.attestationsRepository.getStudentAttempt({ attestationId, userId });
    if (!latest.attempt) {
      return {
        id: expert.id,
        scope: expert.scope,
        moduleId: expert.moduleId,
        displayTitle: expert.displayTitle,
        attempt: null,
        questions: expert.questions.map((q) => ({
          questionId: q.id,
          prompt: q.prompt,
          position: q.position,
          chosenOptionId: null,
          correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? '',
          options: q.options.map((o) => ({ id: o.id, position: o.position, label: o.label })),
        })),
      };
    }
    const review = await this.attestationsRepository.buildReviewFromAttempt({
      attestationId,
      attempt: latest.attempt,
    });
    return {
      id: expert.id,
      scope: expert.scope,
      moduleId: expert.moduleId,
      displayTitle: expert.displayTitle,
      attempt: this.attestationsRepository.attemptToSummary(latest.attempt),
      questions: review.questions,
    };
  }
}

