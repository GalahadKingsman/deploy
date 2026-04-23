import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from './jwt.service.js';
import { UsersRepository } from '../../users/users.repository.js';
import { AuditService } from '../../audit/audit.service.js';
import { ErrorCodes } from '@tracked/shared';

/**
 * Optional JWT Auth Guard
 *
 * If Authorization header is missing, allows request through without setting req.user.
 * If Authorization header is present, validates it like JwtAuthGuard and sets req.user.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: any = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    // No auth header -> anonymous access
    if (!authHeader) return true;

    if (typeof authHeader !== 'string') {
      throw new UnauthorizedException({
        message: 'Invalid Authorization header',
        error: 'Unauthorized',
      });
    }

    // Extract token from "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException({
        message: 'Invalid Authorization header format. Expected: Bearer <token>',
        error: 'Unauthorized',
      });
    }

    const token = parts[1];
    if (!token || token.trim().length === 0) {
      throw new UnauthorizedException({
        message: 'Missing token',
        error: 'Unauthorized',
      });
    }

    // Verify token (throws UnauthorizedException on error)
    const payload = this.jwtService.verifyAccessToken(token);

    // Ban enforcement: load user and reject if banned
    const user = await this.usersRepository.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found',
        error: 'Unauthorized',
      });
    }
    if (user.bannedAt != null) {
      await this.auditService.write({
        actorUserId: user.id,
        action: 'request.blocked.banned',
        entityType: 'user',
        entityId: user.id,
        meta: {
          path: request.url ?? request.raw?.url ?? '/courses/:id',
          method: request.method ?? request.raw?.method ?? 'GET',
          ...(request.headers?.['user-agent'] != null && {
            userAgent: request.headers['user-agent'],
          }),
          ...(request.ip != null && { ip: request.ip }),
        },
        traceId: request.traceId ?? null,
      });
      throw new ForbiddenException({
        code: ErrorCodes.USER_BANNED,
        message: 'Access denied: user is banned',
      });
    }

    // Invalidate sessions issued before password reset/change
    const invalidBeforeIso = (user as { authInvalidBefore?: string | null }).authInvalidBefore ?? null;
    if (invalidBeforeIso) {
      const invalidBefore = new Date(invalidBeforeIso).getTime();
      const issuedAtMs = (payload.iat ?? 0) * 1000;
      if (Number.isFinite(invalidBefore) && Number.isFinite(issuedAtMs) && issuedAtMs < invalidBefore) {
        throw new UnauthorizedException({
          message: 'Token expired',
          error: 'Unauthorized',
        });
      }
    }

    request.user = {
      userId: payload.userId,
      telegramUserId: payload.telegramUserId,
      platformRole: (user as { platformRole?: string }).platformRole ?? 'user',
    };

    return true;
  }
}

