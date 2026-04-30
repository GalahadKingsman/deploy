import { createHmac, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ContractsV1, ErrorCodes, ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import { Pool } from 'pg';
import { UsersRepository } from '../../users/users.repository.js';

const env = validateOrThrow(ApiEnvSchema, process.env);

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(Pool) private readonly pool: Pool,
    private readonly usersRepository: UsersRepository,
  ) {}

  private tokenHash(token: string): string {
    return createHmac('sha256', env.JWT_ACCESS_SECRET).update(token).digest('hex');
  }

  private async insertResetToken(params: {
    userId: string;
    ttlSeconds: number;
    createdByAdminUserId: string | null;
  }): Promise<{ token: string; expiresAt: string; resetPath: string }> {
    const ttl = params.ttlSeconds;
    if (!Number.isFinite(ttl) || ttl < 60 || ttl > 60 * 60 * 24) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid ttlSeconds' });
    }

    const token = randomBytes(32).toString('base64url');
    const hash = this.tokenHash(token);

    const res = await this.pool.query<{ expires_at: Date }>(
      `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_by_admin_user_id)
      VALUES ($1, $2, now() + ($3 || ' seconds')::interval, $4)
      RETURNING expires_at
      `,
      [params.userId, hash, String(ttl), params.createdByAdminUserId],
    );

    const expiresAt = res.rows[0]?.expires_at?.toISOString?.() ?? new Date(Date.now() + ttl * 1000).toISOString();
    return {
      token,
      expiresAt,
      resetPath: `/reset-password?token=${encodeURIComponent(token)}`,
    };
  }

  async adminCreateResetLink(params: {
    adminUserId: string;
    userId: string;
    ttlSeconds?: number;
  }): Promise<ContractsV1.AdminCreatePasswordResetResponseV1> {
    const ttl = params.ttlSeconds ?? 900;
    const u = await this.usersRepository.findById(params.userId);
    if (!u) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'User not found' });

    const { token, expiresAt, resetPath } = await this.insertResetToken({
      userId: params.userId,
      ttlSeconds: ttl,
      createdByAdminUserId: params.adminUserId,
    });
    return { token, expiresAt, resetPath };
  }

  /**
   * Самообслуживание: пользователь по email с паролем в БД.
   * Бросает NotFound / BadRequest с текстами для UI (по требованию продукта).
   */
  async createSelfServiceResetToken(emailRaw: string, ttlSeconds = 900): Promise<{
    token: string;
    expiresAt: string;
    resetUrl: string;
  }> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: 'Такой аккаунт не зарегистрирован на платформе.',
      });
    }
    if (!user.passwordHash) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Для этого аккаунта вход по паролю не настроен. Войдите через Telegram.',
      });
    }

    const { token, expiresAt, resetPath } = await this.insertResetToken({
      userId: user.id,
      ttlSeconds,
      createdByAdminUserId: null,
    });

    const origin = (env.PUBLIC_WEB_ORIGIN ?? '').trim().replace(/\/+$/, '');
    if (!origin) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Сервер не настроен: задайте PUBLIC_WEB_ORIGIN.',
      });
    }
    const resetUrl = `${origin}${resetPath.startsWith('/') ? '' : '/'}${resetPath}`;
    return { token, expiresAt, resetUrl };
  }

  async revokeResetTokenByRawToken(tokenRaw: string): Promise<void> {
    const token = (tokenRaw ?? '').trim();
    if (!token) return;
    const hash = this.tokenHash(token);
    await this.pool.query(`DELETE FROM password_reset_tokens WHERE token_hash = $1`, [hash]);
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

  async previewReset(tokenRaw: string): Promise<ContractsV1.AuthPasswordResetPreviewResponseV1> {
    const token = (tokenRaw ?? '').trim();
    if (!token) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Token required' });
    }
    const hash = this.tokenHash(token);
    const res = await this.pool.query<{ email: string | null; expires_at: Date; used_at: Date | null }>(
      `
      SELECT u.email, prt.expires_at, prt.used_at
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token_hash = $1
      LIMIT 1
      `,
      [hash],
    );
    const row = res.rows[0] ?? null;
    if (!row || row.used_at != null || row.expires_at.getTime() <= Date.now() || !row.email) {
      throw new UnauthorizedException({ code: ErrorCodes.UNAUTHORIZED, message: 'Invalid or expired token' } as any);
    }
    return { email: row.email, expiresAt: row.expires_at.toISOString() };
  }
}
