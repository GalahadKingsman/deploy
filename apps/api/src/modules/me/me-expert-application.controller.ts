import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ContractsV1 } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertApplicationsRepository } from '../../expert-applications/expert-applications.repository.js';
import { AuditService } from '../../audit/audit.service.js';

const NOTE_MAX_LENGTH = 500;

function getTraceId(req: FastifyRequest & { traceId?: string }): string | null {
  const h = req.headers?.['x-request-id'];
  return req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;
}

@ApiTags('User')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeExpertApplicationController {
  constructor(
    private readonly expertApplicationsRepository: ExpertApplicationsRepository,
    private readonly auditService: AuditService,
  ) {}

  @Get('me/expert-application')
  @ApiOperation({ summary: 'Get my expert application' })
  @ApiResponse({ status: 200, description: 'Application or null' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMeExpertApplication(
    @Request()
    request: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.MeExpertApplicationResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new BadRequestException({ message: 'User not found in request' });
    }

    let application: ContractsV1.ExpertApplicationV1 | null = null;
    try {
      application = await this.expertApplicationsRepository.getByUserId(userId);
    } catch {
      // When DB disabled (SKIP_DB=1), return null so UI does not break
      application = null;
    }

    return { application };
  }

  @Post('me/expert-application')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit or resubmit expert application' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { note: { type: 'string', maxLength: NOTE_MAX_LENGTH } },
    },
  })
  @ApiResponse({ status: 200, description: 'Application (created or updated)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async postMeExpertApplication(
    @Request()
    request: FastifyRequest & { user?: { userId: string }; traceId?: string },
    @Body() body: { note?: string },
  ): Promise<ContractsV1.MeExpertApplicationResponseV1> {
    const userId = request.user?.userId;
    if (!userId) {
      throw new BadRequestException({ message: 'User not found in request' });
    }

    let note: string | null = null;
    if (body?.note != null && typeof body.note === 'string') {
      const trimmed = body.note.trim();
      if (trimmed.length > NOTE_MAX_LENGTH) {
        throw new BadRequestException({
          message: `note must be at most ${NOTE_MAX_LENGTH} characters`,
        });
      }
      note = trimmed.length > 0 ? trimmed : null;
    }

    const existing = await this.expertApplicationsRepository.getByUserId(userId);
    const wasRejected = existing?.status === 'rejected';

    const application = await this.expertApplicationsRepository.upsertPending(userId, note);

    const traceId = getTraceId(request);
    this.auditService
      .write({
        actorUserId: userId,
        action: wasRejected ? 'expert.application.resubmitted' : 'expert.application.submitted',
        entityType: 'expert_application',
        entityId: application.id,
        meta: {
          userId,
          status: application.status,
          notePresent: application.note != null && application.note.length > 0,
        },
        traceId,
      })
      .catch((err) => {
        console.warn('AuditService.write failed for expert.application:', err);
      });

    return { application };
  }
}
