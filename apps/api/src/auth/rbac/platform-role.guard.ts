import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes, type ContractsV1 } from '@tracked/shared';

type PlatformRoleV1 = ContractsV1.PlatformRoleV1;
import { AuditService } from '../../audit/audit.service.js';
import { REQUIRE_PLATFORM_ROLE_KEY } from './require-platform-role.decorator.js';
import { isRoleAllowed } from './platform-roles.js';

@Injectable()
export class PlatformRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.get<PlatformRoleV1 | undefined>(
      REQUIRE_PLATFORM_ROLE_KEY,
      context.getHandler(),
    );

    if (!requiredRole) {
      return true;
    }

    const request: any = context.switchToHttp().getRequest();
    const user = request.user as { userId?: string; platformRole?: PlatformRoleV1 } | undefined;

    if (!user?.platformRole) {
      await this.writeAudit(request, requiredRole, undefined);
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN_PLATFORM_ROLE,
        message: 'Insufficient platform role',
      });
    }

    if (!isRoleAllowed(user.platformRole, requiredRole)) {
      await this.writeAudit(request, requiredRole, user.platformRole);
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN_PLATFORM_ROLE,
        message: 'Insufficient platform role',
      });
    }

    return true;
  }

  private async writeAudit(
    request: any,
    requiredRole: PlatformRoleV1,
    userRole: PlatformRoleV1 | undefined,
  ): Promise<void> {
    const actorUserId = request.user?.userId ?? null;
    const traceId = request.traceId ?? request.headers?.['x-request-id'] ?? null;

    await this.auditService.write({
      actorUserId,
      action: 'rbac.denied.platform_role',
      entityType: 'route',
      entityId: request.url ?? request.raw?.url ?? '/',
      meta: {
        requiredRole,
        userRole,
        path: request.url ?? request.raw?.url ?? '/',
        method: request.method ?? request.raw?.method ?? 'GET',
      },
      traceId,
    });
  }
}
