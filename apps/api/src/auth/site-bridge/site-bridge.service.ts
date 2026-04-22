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
import { Pool } from 'pg';
import { Inject, Optional } from '@nestjs/common';

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
    @Optional() @Inject(Pool) private readonly pool: Pool | null,
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
    const exp = Date.now() + BRIDGE_TTL_MS;
    this.memory.set(code, { accessToken, exp });
    if (this.pool) {
      void this.pool
        .query(
          `INSERT INTO auth_site_bridge_codes (code, access_token, expires_at)
           VALUES ($1, $2, to_timestamp($3 / 1000.0))
           ON CONFLICT (code) DO UPDATE SET access_token = EXCLUDED.access_token, expires_at = EXCLUDED.expires_at, consumed_at = NULL`,
          [code, accessToken, exp],
        )
        .catch((e) => this.logger.warn(`site-bridge db insert failed: ${(e as Error).message}`));
    }
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
    let entry = this.memory.get(trimmed) ?? null;

    // Prefer DB (survives restarts); fallback to in-memory for SKIP_DB=1
    if (this.pool) {
      const res = await this.pool.query<{ access_token: string; expires_at: Date; consumed_at: Date | null }>(
        `SELECT access_token, expires_at, consumed_at
         FROM auth_site_bridge_codes
         WHERE code = $1
         LIMIT 1`,
        [trimmed],
      );
      const row = res.rows[0] ?? null;
      if (!row || row.consumed_at != null || row.expires_at.getTime() <= Date.now()) {
        throw new UnauthorizedException({ message: 'Invalid or expired code', error: 'Unauthorized' });
      }
      // Consume (best-effort single use)
      await this.pool.query(
        `UPDATE auth_site_bridge_codes SET consumed_at = now()
         WHERE code = $1 AND consumed_at IS NULL`,
        [trimmed],
      );
      entry = { accessToken: row.access_token, exp: row.expires_at.getTime() };
    } else {
      if (!entry || entry.exp <= Date.now()) {
        if (entry) this.memory.delete(trimmed);
        throw new UnauthorizedException({ message: 'Invalid or expired code', error: 'Unauthorized' });
      }
      this.memory.delete(trimmed);
    }

    let payload: { userId: string; telegramUserId: string };
    try {
      payload = this.jwtService.verifyAccessToken(entry!.accessToken);
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
      accessToken: entry!.accessToken,
    };
  }

  private toPublicUser(u: UserWithBan): ContractsV1.UserV1 {
    const { bannedAt: _b, ...rest } = u;
    return rest;
  }
}
