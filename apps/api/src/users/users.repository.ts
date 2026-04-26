import { Pool } from 'pg';
import { ContractsV1 } from '@tracked/shared';
import { randomBytes } from 'node:crypto';

/**
 * User database model (matches Postgres schema)
 */
interface UserDbModel {
  id: string;
  telegram_user_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  referral_code?: string | null;
  email?: string | null;
  phone?: string | null;
  password_hash?: string | null;
  auth_invalid_before?: Date | null;
  streak_days?: number | null;
  streak_last_day?: string | null;
  created_at: Date;
  updated_at: Date;
  banned_at: Date | null;
  ban_reason: string | null;
  platform_role: string;
}

/** User with optional bannedAt/authInvalidBefore (server-side only, not in public contract) */
export type UserWithBan = ContractsV1.UserV1 & { bannedAt?: string | null; authInvalidBefore?: string | null };

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

  async findByTelegramUserId(telegramUserId: string): Promise<(UserWithBan & { email?: string | null; passwordHash?: string | null }) | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const result = await this.pool.query<UserDbModel>(
      `SELECT * FROM users WHERE telegram_user_id = $1 LIMIT 1`,
      [telegramUserId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...this.mapRowToUserWithBan(row),
      email: row.email ?? null,
      passwordHash: row.password_hash ?? null,
    };
  }

  async findByEmail(email: string): Promise<(UserWithBan & { passwordHash?: string | null }) | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const clean = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!clean) return null;
    const res = await this.pool.query<UserDbModel>(`SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1`, [clean]);
    const row = res.rows[0];
    if (!row) return null;
    return { ...this.mapRowToUserWithBan(row), passwordHash: row.password_hash ?? null };
  }

  async createEmailUser(params: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<UserWithBan> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const email = params.email.trim().toLowerCase();
    const firstName = params.firstName.trim();
    const lastName = params.lastName.trim();
    const passwordHash = params.passwordHash;
    const res = await this.pool.query<UserDbModel>(
      `
      INSERT INTO users (telegram_user_id, email, password_hash, first_name, last_name, avatar_url, created_at, updated_at)
      VALUES (NULL, $1, $2, $3, $4, NULL, NOW(), NOW())
      RETURNING *
      `,
      [email, passwordHash, firstName, lastName],
    );
    return this.mapRowToUserWithBan(res.rows[0]);
  }

  async setPasswordHashAndInvalidateSessions(userId: string, passwordHash: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    await this.pool.query(
      `UPDATE users
       SET password_hash = $2, auth_invalid_before = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [userId, passwordHash],
    );
  }

  async updateProfile(params: {
    userId: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }): Promise<UserWithBan> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const sets: string[] = [];
    const values: unknown[] = [params.userId];
    let i = 2;
    if (params.firstName !== undefined) {
      sets.push(`first_name = $${i}`);
      values.push(params.firstName);
      i += 1;
    }
    if (params.lastName !== undefined) {
      sets.push(`last_name = $${i}`);
      values.push(params.lastName);
      i += 1;
    }
    if (params.email !== undefined) {
      sets.push(`email = $${i}`);
      values.push(params.email);
      i += 1;
    }
    if (sets.length === 0) {
      const cur = await this.pool.query<UserDbModel>(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [params.userId]);
      if (!cur.rows[0]) throw new Error('User not found');
      return this.mapRowToUserWithBan(cur.rows[0]);
    }
    sets.push(`updated_at = NOW()`);
    const res = await this.pool.query<UserDbModel>(
      `
      UPDATE users
      SET ${sets.join(', ')}
      WHERE id = $1
      RETURNING *
      `,
      values,
    );
    if (!res.rows[0]) throw new Error('User not found');
    return this.mapRowToUserWithBan(res.rows[0]);
  }

  async updateAvatarUrl(userId: string, avatarUrl: string | null): Promise<UserWithBan> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query<UserDbModel>(
      `UPDATE users SET avatar_url = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [userId, avatarUrl],
    );
    if (!res.rows[0]) throw new Error('User not found');
    return this.mapRowToUserWithBan(res.rows[0]);
  }

  async connectTelegram(params: {
    userId: string;
    telegramUserId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  }): Promise<{ ok: true; user: UserWithBan } | { ok: false; reason: 'telegram_already_linked' }> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    // If telegram id already linked to a different user → reject
    const existing = await this.pool.query<{ id: string }>(`SELECT id FROM users WHERE telegram_user_id = $1 LIMIT 1`, [
      params.telegramUserId,
    ]);
    const found = existing.rows[0]?.id ?? null;
    if (found && found !== params.userId) return { ok: false, reason: 'telegram_already_linked' };

    const res = await this.pool.query<UserDbModel>(
      `
      UPDATE users
      SET telegram_user_id = $2,
          username = COALESCE($3, username),
          first_name = COALESCE($4, first_name),
          last_name = COALESCE($5, last_name),
          avatar_url = COALESCE($6, avatar_url),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [params.userId, params.telegramUserId, params.username ?? null, params.firstName ?? null, params.lastName ?? null, params.avatarUrl ?? null],
    );
    if (!res.rows[0]) throw new Error('User not found');
    return { ok: true, user: this.mapRowToUserWithBan(res.rows[0]) };
  }

  async unlinkTelegram(userId: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    await this.pool.query(`UPDATE users SET telegram_user_id = NULL, updated_at = NOW() WHERE id = $1`, [userId]);
  }

  async mergeUserData(params: { fromUserId: string; toUserId: string }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    if (params.fromUserId === params.toUserId) return;

    await this.pool.query('BEGIN');
    try {
      // Platform role: keep the "highest" role between two users.
      // Order: user < moderator < admin < owner
      const roles = await this.pool.query<{ id: string; platform_role: string }>(
        `SELECT id, platform_role FROM users WHERE id = ANY($1::uuid[])`,
        [[params.fromUserId, params.toUserId]],
      );
      const roleById = new Map(roles.rows.map((r) => [r.id, (r.platform_role ?? 'user') as string]));
      const a = roleById.get(params.fromUserId) ?? 'user';
      const b = roleById.get(params.toUserId) ?? 'user';
      const rank = (r: string) => (r === 'owner' ? 3 : r === 'admin' ? 2 : r === 'moderator' ? 1 : 0);
      const nextRole = rank(a) > rank(b) ? a : b;
      await this.pool.query(`UPDATE users SET platform_role = $2, updated_at = NOW() WHERE id = $1`, [
        params.toUserId,
        nextRole,
      ]);

      // Expert memberships: copy roles into target
      await this.pool.query(
        `
        INSERT INTO expert_members (expert_id, user_id, role, created_at)
        SELECT em.expert_id, $2, em.role, em.created_at
        FROM expert_members em
        WHERE em.user_id = $1
        ON CONFLICT (expert_id, user_id) DO NOTHING
        `,
        [params.fromUserId, params.toUserId],
      );

      // Enrollments: move access (keep best access_end, and never re-add revoked if target is active)
      await this.pool.query(
        `
        INSERT INTO enrollments (id, user_id, course_id, access_end, revoked_at, created_at, updated_at)
        SELECT gen_random_uuid(), $2, e.course_id, e.access_end, e.revoked_at, e.created_at, NOW()
        FROM enrollments e
        WHERE e.user_id = $1
        ON CONFLICT (user_id, course_id)
        DO UPDATE SET
          access_end = CASE
            WHEN EXCLUDED.access_end IS NULL THEN enrollments.access_end
            WHEN enrollments.access_end IS NULL THEN EXCLUDED.access_end
            ELSE GREATEST(enrollments.access_end, EXCLUDED.access_end)
          END,
          revoked_at = CASE
            WHEN enrollments.revoked_at IS NULL THEN NULL
            ELSE EXCLUDED.revoked_at
          END,
          updated_at = NOW()
        `,
        [params.fromUserId, params.toUserId],
      );

      // Lesson progress: union
      await this.pool.query(
        `
        INSERT INTO lesson_progress (user_id, lesson_id, completed_at)
        SELECT $2, lp.lesson_id, lp.completed_at
        FROM lesson_progress lp
        WHERE lp.user_id = $1
        ON CONFLICT (user_id, lesson_id) DO NOTHING
        `,
        [params.fromUserId, params.toUserId],
      );

      // Submissions: reassign
      await this.pool.query(`UPDATE submissions SET student_user_id = $2 WHERE student_user_id = $1`, [
        params.fromUserId,
        params.toUserId,
      ]);

      // Cleanup: remove moved rows that are now redundant
      await this.pool.query(`DELETE FROM expert_members WHERE user_id = $1`, [params.fromUserId]);
      await this.pool.query(`DELETE FROM lesson_progress WHERE user_id = $1`, [params.fromUserId]);
      await this.pool.query(`DELETE FROM enrollments WHERE user_id = $1`, [params.fromUserId]);

      await this.pool.query('COMMIT');
    } catch (e) {
      await this.pool.query('ROLLBACK');
      throw e;
    }
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
          OR TRIM(
              COALESCE(NULLIF(first_name, ''), '') || ' ' || COALESCE(NULLIF(last_name, ''), '')
            ) ILIKE $${p}
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

  /**
   * Update daily login streak on user "visit".
   * Rules (UTC):
   * - first visit -> streak=1
   * - same day -> unchanged
   * - next day -> +1
   * - gap -> reset to 1
   */
  async bumpStreakOnVisit(userId: string): Promise<UserWithBan> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const res = await this.pool.query<UserDbModel>(
      `
      WITH today AS (
        SELECT (NOW() AT TIME ZONE 'UTC')::date AS d
      )
      UPDATE users u
      SET
        streak_days = CASE
          WHEN u.streak_last_day IS NULL THEN 1
          WHEN u.streak_last_day = (SELECT d FROM today) THEN u.streak_days
          WHEN u.streak_last_day = ((SELECT d FROM today) - INTERVAL '1 day')::date THEN u.streak_days + 1
          ELSE 1
        END,
        streak_last_day = (SELECT d FROM today),
        updated_at = NOW()
      WHERE u.id = $1
      RETURNING *
      `,
      [userId],
    );
    if (res.rows.length === 0) {
      throw new Error(`User not found: ${userId}`);
    }
    return this.mapRowToUserWithBan(res.rows[0]);
  }

  private mapRowToUserWithBan(row: UserDbModel): UserWithBan {
    const role = row.platform_role ?? 'user';
    return {
      id: row.id,
      telegramUserId: row.telegram_user_id ?? undefined,
      username: row.username ?? undefined,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      avatarUrl: row.avatar_url ?? null,
      email: row.email ?? null,
      streakDays: Math.max(0, Number(row.streak_days ?? 0) || 0),
      platformRole: role as 'user' | 'moderator' | 'admin' | 'owner',
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      bannedAt: row.banned_at ? row.banned_at.toISOString() : null,
      authInvalidBefore: row.auth_invalid_before ? row.auth_invalid_before.toISOString() : null,
    };
  }
}
