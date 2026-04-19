import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { JwtService } from '../session/jwt.service.js';
import { UsersRepository, type UserWithBan } from '../../users/users.repository.js';
import { AuditService } from '../../audit/audit.service.js';

const BRIDGE_TTL_MS = 10 * 60 * 1000;
const CODE_BYTES = 16;

type BridgeEntry = { accessToken: string; exp: number };

@Injectable()
export class SiteBridgeService {
  private readonly logger = new Logger(SiteBridgeService.name);
  private readonly memory = new Map<string, BridgeEntry>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  private pruneExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.memory) {
      if (v.exp <= now) this.memory.delete(k);
    }
  }

  issueCode(accessToken: string): string {
    this.pruneExpired();
    const code = randomBytes(CODE_BYTES).toString('hex');
    this.memory.set(code, { accessToken, exp: Date.now() + BRIDGE_TTL_MS });
    this.logger.log(`site-bridge code issued, len=${code.length}`);
    return code;
  }

  async claimAndConsume(
    code: string,
    requestContext?: {
      traceId?: string | null;
      path?: string;
      method?: string;
      userAgent?: string;
      ip?: string;
    },
  ): Promise<ContractsV1.AuthTelegramResponseV1> {
    this.pruneExpired();
    const trimmed = typeof code === 'string' ? code.trim() : '';
    if (!trimmed) {
      throw new UnauthorizedException({ message: 'Invalid code', error: 'Unauthorized' });
    }
    const entry = this.memory.get(trimmed);
    if (!entry || entry.exp <= Date.now()) {
      if (entry) this.memory.delete(trimmed);
      throw new UnauthorizedException({ message: 'Invalid or expired code', error: 'Unauthorized' });
    }
    this.memory.delete(trimmed);

    let payload: { userId: string; telegramUserId: string };
    try {
      payload = this.jwtService.verifyAccessToken(entry.accessToken);
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException({ message: 'Invalid token', error: 'Unauthorized' });
    }

    const user = await this.usersRepository.findById(payload.userId);
    if (!user) {
      throw new UnauthorizedException({ message: 'User not found', error: 'Unauthorized' });
    }
    if (user.bannedAt != null) {
      await this.auditService.write({
        actorUserId: user.id,
        action: 'auth.blocked.banned',
        entityType: 'user',
        entityId: user.id,
        meta: {
          path: requestContext?.path ?? '/auth/site-bridge/claim',
          method: requestContext?.method ?? 'POST',
          ...(requestContext?.userAgent != null && { userAgent: requestContext.userAgent }),
          ...(requestContext?.ip != null && { ip: requestContext.ip }),
        },
        traceId: requestContext?.traceId ?? null,
      });
      throw new ForbiddenException({
        code: ErrorCodes.USER_BANNED,
        message: 'Access denied: user is banned',
      });
    }

    return {
      user: this.toPublicUser(user),
      accessToken: entry.accessToken,
    };
  }

  private toPublicUser(u: UserWithBan): ContractsV1.UserV1 {
    const { bannedAt: _b, ...rest } = u;
    return rest;
  }
}
