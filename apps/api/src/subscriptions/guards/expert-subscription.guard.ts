import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ErrorCodes } from '@tracked/shared';
import { AuditService } from '../../audit/audit.service.js';
import { ExpertSubscriptionsRepository } from '../expert-subscriptions.repository.js';

@Injectable()
export class ExpertSubscriptionGuard implements CanActivate {
  constructor(
    private readonly expertSubscriptionsRepository: ExpertSubscriptionsRepository,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const expertId = this.getExpertIdFromParams(request);
    if (!expertId) {
      return true; // Let route/param validation or other guards handle missing expertId
    }

    await this.expertSubscriptionsRepository.ensureDefault(expertId);
    const sub = await this.expertSubscriptionsRepository.findByExpertId(expertId);
    if (!sub) {
      return true; // Should not happen after ensureDefault
    }

    const now = new Date();
    const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
    const isActive =
      sub.status === 'active' && (periodEnd === null || periodEnd.getTime() > now.getTime());

    if (!isActive) {
      const traceId = request.traceId ?? request.headers?.['x-request-id'] ?? null;
      const path = request.url ?? request.raw?.url ?? '/';
      const method = request.method ?? request.raw?.method ?? 'GET';

      await this.auditService.write({
        actorUserId: request.user?.userId ?? null,
        action: 'subscription.denied.expert_subscription_inactive',
        entityType: 'route',
        entityId: path,
        meta: {
          expertId,
          plan: sub.plan,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd ?? null,
          path,
          method,
        },
        traceId,
      });

      throw new ForbiddenException({
        code: ErrorCodes.EXPERT_SUBSCRIPTION_INACTIVE,
        message: 'Expert subscription inactive or expired',
      });
    }

    return true;
  }

  private getExpertIdFromParams(request: any): string | null {
    const fromParams = request.params?.expertId;
    if (typeof fromParams === 'string' && fromParams.trim() !== '') {
      return fromParams.trim();
    }
    return null;
  }
}
