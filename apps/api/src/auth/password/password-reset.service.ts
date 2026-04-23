import { createHmac, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ContractsV1, ErrorCodes, ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import type { Pool } from 'pg';
import { UsersRepository } from '../../users/users.repository.js';

const env = validateOrThrow(ApiEnvSchema, process.env);

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly pool: Pool,
    private readonly usersRepository: UsersRepository,
  ) {}

  private tokenHash(token: string): string {
    return createHmac('sha256', env.JWT_ACCESS_SECRET).update(token).digest('hex');
  }

  async adminCreateResetLink(params: {
    adminUserId: string;
    userId: string;
    ttlSeconds?: number;
  }): Promise<ContractsV1.AdminCreatePasswordResetResponseV1> {
    const ttl = params.ttlSeconds ?? 900;
    if (!Number.isFinite(ttl) || ttl < 60 || ttl > 60 * 60 * 24) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid ttlSeconds' });
    }

    const u = await this.usersRepository.findById(params.userId);
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });

    const token = randomBytes(32).toString('base64url');
    const hash = this.tokenHash(token);

    const res = await this.pool.query<{ expires_at: Date }>(
      `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_by_admin_user_id)
      VALUES ($1, $2, now() + ($3 || ' seconds')::interval, $4)
      RETURNING expires_at
      `,
      [params.userId, hash, String(ttl), params.adminUserId],
    );

    const expiresAt = res.rows[0]?.expires_at?.toISOString?.() ?? new Date(Date.now() + ttl * 1000).toISOString();
    return {
      token,
      expiresAt,
      resetPath: `/reset-password?token=${encodeURIComponent(token)}`,
    };
  }

  async confirmReset(input: ContractsV1.AuthPasswordResetConfirmRequestV1): Promise<ContractsV1.AuthPasswordResetConfirmResponseV1> {
    const token = input.token.trim();
    if (!token) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Token required' });
    }
    const hash = this.tokenHash(token);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const rowRes = await client.query<{ user_id: string; expires_at: Date; used_at: Date | null }>(
        `
        SELECT user_id, expires_at, used_at
        FROM password_reset_tokens
        WHERE token_hash = $1
        LIMIT 1
        `,
        [hash],
      );
      const row = rowRes.rows[0] ?? null;
      if (!row || row.used_at != null || row.expires_at.getTime() <= Date.now()) {
        throw new UnauthorizedException({ code: ErrorCodes.UNAUTHORIZED, message: 'Invalid or expired token' } as any);
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 10);
      await client.query(
        `UPDATE users SET password_hash = $2, auth_invalid_before = NOW(), updated_at = NOW() WHERE id = $1`,
        [row.user_id, passwordHash],
      );
      await client.query(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL`,
        [hash],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      if (e instanceof UnauthorizedException) throw e;
      throw e;
    } finally {
      client.release();
    }

    return { ok: true };
  }
}

