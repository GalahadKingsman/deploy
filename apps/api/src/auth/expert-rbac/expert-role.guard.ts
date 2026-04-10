import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes, type ContractsV1 } from '@tracked/shared';
import { AuditService } from '../../audit/audit.service.js';
import { ExpertMembersRepository } from '../../experts/expert-members.repository.js';
import { REQUIRE_EXPERT_ROLE_KEY } from './require-expert-role.decorator.js';
import { isExpertRoleAllowed } from './expert-roles.js';

type ExpertMemberRoleV1 = ContractsV1.ExpertMemberRoleV1;

@Injectable()
export class ExpertRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly expertMembersRepository: ExpertMembersRepository,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.get<ExpertMemberRoleV1 | undefined>(
      REQUIRE_EXPERT_ROLE_KEY,
      context.getHandler(),
    );

    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const expertId = this.resolveExpertId(request);
    if (!expertId) {
      throw new BadRequestException({
        code: ErrorCodes.EXPERT_CONTEXT_REQUIRED,
        message:
          process.env.NODE_ENV === 'production'
            ? 'Expert context required (expertId in path)'
            : 'Expert context required (expertId in path or x-expert-id header in dev/test)',
      });
    }

    const user = request.user as { userId?: string } | undefined;
    const userId = user?.userId;
    if (!userId) {
      await this.writeAuditDeny(request, expertId, requiredRole, undefined, 'expert_membership');
      throw new ForbiddenException({
        code: ErrorCodes.EXPERT_MEMBERSHIP_REQUIRED,
        message: 'Expert membership required',
      });
    }

    const member = await this.expertMembersRepository.findMember(expertId, userId);
    if (!member) {
      await this.writeAuditDeny(request, expertId, requiredRole, undefined, 'expert_membership');
      throw new ForbiddenException({
        code: ErrorCodes.EXPERT_MEMBERSHIP_REQUIRED,
        message: 'Expert membership required',
      });
    }

    if (!isExpertRoleAllowed(member.role as ExpertMemberRoleV1, requiredRole)) {
      await this.writeAuditDeny(request, expertId, requiredRole, member.role, 'expert_role');
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN_EXPERT_ROLE,
        message: 'Insufficient expert role',
      });
    }

    return true;
  }

  private resolveExpertId(request: any): string {
    const fromParams = request.params?.expertId;
    if (typeof fromParams === 'string' && fromParams.trim() !== '') {
      return fromParams.trim();
    }
    // x-expert-id fallback only in dev/test; in production always require :expertId in path
    if (process.env.NODE_ENV !== 'production') {
      const fromHeader = request.headers?.['x-expert-id'];
      const headerValue =
        typeof fromHeader === 'string'
          ? fromHeader
          : Array.isArray(fromHeader)
            ? fromHeader[0]
            : undefined;
      if (typeof headerValue === 'string' && headerValue.trim() !== '') {
        return headerValue.trim();
      }
    }
    return '';
  }

  private async writeAuditDeny(
    request: any,
    expertId: string,
    requiredRole: ExpertMemberRoleV1,
    userRole: string | undefined,
    actionSuffix: 'expert_membership' | 'expert_role',
  ): Promise<void> {
    const actorUserId = request.user?.userId ?? null;
    const traceId = request.traceId ?? request.headers?.['x-request-id'] ?? null;
    const path = request.url ?? request.raw?.url ?? '/';
    const method = request.method ?? request.raw?.method ?? 'GET';

    await this.auditService.write({
      actorUserId,
      action: `rbac.denied.${actionSuffix}`,
      entityType: 'route',
      entityId: path,
      meta: {
        expertId,
        requiredRole,
        userRole: userRole ?? null,
        path,
        method,
      },
      traceId,
    });
  }
}
