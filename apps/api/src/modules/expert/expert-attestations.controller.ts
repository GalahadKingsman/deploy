import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertRoleGuard } from '../../auth/expert-rbac/expert-role.guard.js';
import { ExpertSubscriptionGuard } from '../../subscriptions/guards/expert-subscription.guard.js';
import { RequireExpertRole } from '../../auth/expert-rbac/require-expert-role.decorator.js';
import { CoursesRepository } from '../../authoring/courses.repository.js';
import { AttestationsRepository } from '../../authoring/attestations.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import { ExpertCourseAccessService } from './expert-course-access.service.js';

function getTraceId(req: FastifyRequest & { traceId?: string }): string | null {
  const h = req.headers?.['x-request-id'];
  return req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;
}

@ApiTags('Expert Attestations')
@Controller('experts/:expertId/courses/:courseId/attestations')
@UseGuards(JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard)
@ApiBearerAuth()
export class ExpertAttestationsController {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly attestationsRepository: AttestationsRepository,
    private readonly auditService: AuditService,
    private readonly expertCourseAccessService: ExpertCourseAccessService,
  ) {}

  @Get()
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'List course attestations (support+)' })
  @ApiResponse({ status: 200, description: 'Attestations list (with questions/options)' })
  async list(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ListExpertAttestationsResponseV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
    const items = await this.attestationsRepository.listByCourseId(courseId);
    return { items };
  }

  @Post()
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create attestation (manager+)' })
  @ApiResponse({ status: 201, description: 'Attestation created' })
  async create(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Body() body: ContractsV1.CreateExpertAttestationRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertAttestationV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
    const parsed = ContractsV1.CreateExpertAttestationRequestV1Schema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    const moduleId = parsed.data.moduleId ?? null;
    if (moduleId) {
      await this.attestationsRepository.assertModuleInCourse({ courseId, moduleId });
    }
    const created = await this.attestationsRepository.create({ courseId, moduleId });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.attestation.create',
      entityType: 'attestation',
      entityId: created.id,
      meta: { expertId, courseId, moduleId: moduleId ?? null, scope: created.scope },
      traceId: getTraceId(req),
    });
    return created;
  }

  @Get(':attestationId')
  @RequireExpertRole('support')
  @ApiOperation({ summary: 'Get attestation by id (support+)' })
  @ApiResponse({ status: 200, description: 'Attestation' })
  async getOne(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Param('attestationId') attestationId: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.ExpertAttestationV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
    const found = await this.attestationsRepository.assertBelongsToExpert({ expertId, attestationId });
    if (found.courseId !== courseId) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Attestation does not belong to this course',
      });
    }
    return this.attestationsRepository.getById(attestationId);
  }

  @Patch(':attestationId')
  @RequireExpertRole('manager')
  @ApiOperation({ summary: 'Replace attestation questions (manager+)' })
  @ApiResponse({ status: 200, description: 'Attestation updated' })
  async update(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Param('attestationId') attestationId: string,
    @Body() body: ContractsV1.UpdateExpertAttestationRequestV1,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.ExpertAttestationV1> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
    const found = await this.attestationsRepository.assertBelongsToExpert({ expertId, attestationId });
    if (found.courseId !== courseId) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Attestation does not belong to this course',
      });
    }
    const parsed = ContractsV1.UpdateExpertAttestationRequestV1Schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        errors: parsed.error.errors,
      });
    }
    const updated = await this.attestationsRepository.replaceQuestions({
      attestationId,
      questions: parsed.data.questions,
    });
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.attestation.update',
      entityType: 'attestation',
      entityId: attestationId,
      meta: { expertId, courseId, questions: parsed.data.questions.length },
      traceId: getTraceId(req),
    });
    return updated;
  }

  @Delete(':attestationId')
  @RequireExpertRole('manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete attestation (manager+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async remove(
    @Param('expertId') expertId: string,
    @Param('courseId') courseId: string,
    @Param('attestationId') attestationId: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<{ ok: true }> {
    await this.coursesRepository.getById({ expertId, courseId });
    await this.expertCourseAccessService.assertCanAccessCourse({
      expertId,
      userId: req.user!.userId,
      courseId,
    });
    const found = await this.attestationsRepository.assertBelongsToExpert({ expertId, attestationId });
    if (found.courseId !== courseId) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Attestation does not belong to this course',
      });
    }
    await this.attestationsRepository.softDelete(attestationId);
    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'expert.attestation.delete',
      entityType: 'attestation',
      entityId: attestationId,
      meta: { expertId, courseId },
      traceId: getTraceId(req),
    });
    return { ok: true };
  }
}
