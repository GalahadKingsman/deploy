import { Pool } from 'pg';
import { ContractsV1 } from '@tracked/shared';
import { randomBytes } from 'node:crypto';

/**
 * User database model (matches Postgres schema)
 */
interface UserDbModel {
  id: string;
  telegram_user_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  referral_code?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at: Date;
  updated_at: Date;
  banned_at: Date | null;
  ban_reason: string | null;
  platform_role: string;
}

/** User with optional bannedAt (server-side only, not in public contract) */
export type UserWithBan = ContractsV1.UserV1 & { bannedAt?: string | null };

/**
 * Users repository for database operations
 */
export class UsersRepository {
  constructor(private readonly pool: Pool | null) {}

  private generateReferralCode(): string {
    // Short, URL-safe, collision-resistant. Format: REF-XXXXXXXXXX
    const raw = randomBytes(6).toString('base64url'); // ~8 chars, url-safe
    const code = raw.replace(/[-_]/g, '').slice(0, 10).toUpperCase();
    return `REF-${code}`;
  }

  async getOrCreateReferralCode(userId: string): Promise<string> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    // Fast path: already set
    const existing = await this.pool.query<{ referral_code: string | null }>(
      `SELECT referral_code FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const current = existing.rows[0]?.referral_code ?? null;
    if (current) return current;

    // Try to set a new one; handle rare unique collisions by retrying.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const next = this.generateReferralCode();
      try {
        const updated = await this.pool.query<{ referral_code: string | null }>(
          `UPDATE users SET referral_code = $2, updated_at = NOW() WHERE id = $1 AND referral_code IS NULL RETURNING referral_code`,
          [userId, next],
        );
        const v = updated.rows[0]?.referral_code ?? null;
        if (v) return v;

        // Someone else set it concurrently; read and return.
        const reread = await this.pool.query<{ referral_code: string | null }>(
          `SELECT referral_code FROM users WHERE id = $1 LIMIT 1`,
          [userId],
        );
        const got = reread.rows[0]?.referral_code ?? null;
        if (got) return got;
      } catch (e) {
        const err = e as { code?: string };
        if (err?.code === '23505') {
          continue; // unique violation, retry
        }
        throw e;
      }
    }

    throw new Error('Failed to generate unique referral code');
  }

  /**
   * Upsert user by telegram_user_id
   *
   * Creates user if not exists, updates if exists
   */
  async upsertByTelegramUserId(data: {
    telegramUserId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  }): Promise<UserWithBan> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const now = new Date();

    const query = `
      INSERT INTO users (
        telegram_user_id,
        username,
        first_name,
        last_name,
        avatar_url,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6)
      ON CONFLICT (telegram_user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const values = [
      data.telegramUserId,
      data.username ?? null,
      data.firstName ?? null,
      data.lastName ?? null,
      data.avatarUrl ?? null,
      now,
    ];

    const result = await this.pool.query<UserDbModel>(query, values);

    if (result.rows.length === 0) {
      throw new Error('Failed to upsert user');
    }

    const row = result.rows[0];

    return this.mapRowToUserWithBan(row);
  }

  /**
   * Update user's platform role (idempotent)
   */
  async updatePlatformRole(
    userId: string,
    role: 'user' | 'moderator' | 'admin' | 'owner',
  ): Promise<UserWithBan> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const query = `
      UPDATE users
      SET platform_role = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query<UserDbModel>(query, [userId, role]);

    if (result.rows.length === 0) {
      throw new Error(`User not found: ${userId}`);
    }

    return this.mapRowToUserWithBan(result.rows[0]);
  }

  /**
   * Find user by ID
   *
   * @param id - User ID (UUID)
   * @returns User data or null if not found
   */
  async findById(id: string): Promise<UserWithBan | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const query = `
      SELECT *
      FROM users
      WHERE id = $1
    `;

    const result = await this.pool.query<UserDbModel>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUserWithBan(result.rows[0]);
  }

  async findByTelegramUserId(telegramUserId: string): Promise<UserWithBan | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const result = await this.pool.query<UserDbModel>(
      `SELECT * FROM users WHERE telegram_user_id = $1 LIMIT 1`,
      [telegramUserId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToUserWithBan(result.rows[0]);
  }

  async findByUsername(username: string): Promise<UserWithBan | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const u = typeof username === 'string' ? username.trim() : '';
    if (!u) return null;
    const result = await this.pool.query<UserDbModel>(
      `SELECT * FROM users WHERE lower(username) = lower($1) LIMIT 1`,
      [u],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToUserWithBan(result.rows[0]);
  }

  /**
   * Admin: list/search users (for selecting users in admin UI)
   */
  async adminList(params?: {
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: UserWithBan[] }> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const q = typeof params?.q === 'string' ? params.q.trim() : '';
    const limitRaw = params?.limit ?? 50;
    const offsetRaw = params?.offset ?? 0;
    const limit =
      typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;
    const offset =
      typeof offsetRaw === 'number' && Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    const values: Array<string | number> = [limit, offset];
    let where = '';
    if (q) {
      // Search by: uuid, telegram id, username, first/last name (case-insensitive)
      values.push(`%${q}%`);
      const p = values.length;
      where = `
        WHERE
          id::text ILIKE $${p}
          OR telegram_user_id ILIKE $${p}
          OR COALESCE(username, '') ILIKE $${p}
          OR COALESCE(first_name, '') ILIKE $${p}
          OR COALESCE(last_name, '') ILIKE $${p}
      `;
    }

    const res = await this.pool.query<UserDbModel>(
      `
      SELECT *
      FROM users
      ${where}
      ORDER BY updated_at DESC
      LIMIT $1
      OFFSET $2
      `,
      values,
    );

    return { items: res.rows.map((r) => this.mapRowToUserWithBan(r)) };
  }

  async updateContact(params: { userId: string; email?: string | null; phone?: string | null }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const sets: string[] = [];
    const values: unknown[] = [params.userId];
    let i = 2;

    if (params.email !== undefined) {
      sets.push(`email = $${i}`);
      values.push(params.email);
      i += 1;
    }
    if (params.phone !== undefined) {
      sets.push(`phone = $${i}`);
      values.push(params.phone);
      i += 1;
    }

    // always touch updated_at if any field provided
    if (sets.length === 0) return;
    sets.push(`updated_at = NOW()`);

    await this.pool.query(
      `
      UPDATE users
      SET ${sets.join(', ')}
      WHERE id = $1
      `,
      values,
    );
  }

  async getContact(userId: string): Promise<{ email: string | null; phone: string | null }> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query<{ email: string | null; phone: string | null }>(
      `SELECT email, phone FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const row = res.rows[0];
    return { email: row?.email ?? null, phone: row?.phone ?? null };
  }

  private mapRowToUserWithBan(row: UserDbModel): UserWithBan {
    const role = row.platform_role ?? 'user';
    return {
      id: row.id,
      telegramUserId: row.telegram_user_id,
      username: row.username ?? undefined,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      avatarUrl: row.avatar_url ?? null,
      platformRole: role as 'user' | 'moderator' | 'admin' | 'owner',
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      bannedAt: row.banned_at ? row.banned_at.toISOString() : null,
    };
  }
}
