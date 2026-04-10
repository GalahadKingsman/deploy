import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { RequirePlatformRole } from '../../auth/rbac/require-platform-role.decorator.js';
import { ExpertSubscriptionsRepository } from '../../subscriptions/expert-subscriptions.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import type { FastifyRequest } from 'fastify';

interface ReqWithUser extends FastifyRequest {
  user?: { userId: string };
  traceId?: string;
}

function getTraceId(req: ReqWithUser): string | null {
  const h = req.headers?.['x-request-id'];
  return req.traceId ?? (Array.isArray(h) ? h[0] : typeof h === 'string' ? h : null) ?? null;
}

const MIN_DAYS = 1;
const MAX_DAYS = 3650;

@ApiTags('Admin')
@Controller('admin/experts')
@UseGuards(JwtAuthGuard, PlatformRoleGuard)
@ApiBearerAuth()
export class AdminSubscriptionsController {
  constructor(
    private readonly expertSubscriptionsRepository: ExpertSubscriptionsRepository,
    private readonly auditService: AuditService,
  ) {}

  @Post(':expertId/subscription/grant-days')
  @RequirePlatformRole('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grant N days to expert subscription (owner only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { days: { type: 'integer', minimum: 1, maximum: 3650 } },
      required: ['days'],
    },
  })
  @ApiResponse({ status: 200, description: 'Subscription updated' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  @ApiResponse({ status: 404, description: 'EXPERT_NOT_FOUND' })
  async grantDays(
    @Param('expertId') expertId: string,
    @Body() body: { days?: unknown },
    @Req() req: ReqWithUser,
  ): Promise<ContractsV1.ExpertSubscriptionV1> {
    const daysRaw = body?.days;
    const days =
      typeof daysRaw === 'number' && Number.isInteger(daysRaw)
        ? daysRaw
        : typeof daysRaw === 'string'
          ? parseInt(daysRaw, 10)
          : NaN;
    if (Number.isNaN(days) || days < MIN_DAYS || days > MAX_DAYS) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `days must be an integer between ${MIN_DAYS} and ${MAX_DAYS}`,
      });
    }

    const before = await this.expertSubscriptionsRepository.findByExpertId(expertId);
    const subscription = await this.expertSubscriptionsRepository.grantDays(expertId, days);
    const traceId = getTraceId(req);

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.expert_subscription.grant_days',
      entityType: 'expert_subscription',
      entityId: expertId,
      meta: {
        expertId,
        days,
        fromStatus: before?.status ?? null,
        toStatus: subscription.status,
        fromEnd: before?.currentPeriodEnd ?? null,
        toEnd: subscription.currentPeriodEnd,
      },
      traceId,
    });

    return subscription;
  }

  @Post(':expertId/subscription/expire')
  @RequirePlatformRole('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Expire expert subscription now (owner only)' })
  @ApiResponse({ status: 200, description: 'Subscription expired' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN_PLATFORM_ROLE' })
  @ApiResponse({ status: 404, description: 'EXPERT_NOT_FOUND' })
  async expire(
    @Param('expertId') expertId: string,
    @Req() req: ReqWithUser,
  ): Promise<ContractsV1.ExpertSubscriptionV1> {
    const before = await this.expertSubscriptionsRepository.findByExpertId(expertId);
    const subscription = await this.expertSubscriptionsRepository.expireNow(expertId);
    const traceId = getTraceId(req);

    await this.auditService.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.expert_subscription.expire',
      entityType: 'expert_subscription',
      entityId: expertId,
      meta: {
        expertId,
        fromStatus: before?.status ?? null,
        fromEnd: before?.currentPeriodEnd ?? null,
        toStatus: 'expired',
        toEnd: subscription.currentPeriodEnd,
      },
      traceId,
    });

    return subscription;
  }
}
