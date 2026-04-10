import { Pool } from 'pg';
import { randomUUID, randomBytes } from 'node:crypto';
import type { ContractsV1 } from '@tracked/shared';

interface InviteRow {
  id: string;
  course_id: string;
  code: string;
  expires_at: Date | null;
  max_uses: number | null;
  uses_count: number;
  revoked_at: Date | null;
  created_by_user_id: string | null;
  created_at: Date;
}

function mapRow(r: InviteRow): ContractsV1.InviteV1 {
  return {
    id: r.id,
    code: r.code,
    courseId: r.course_id,
    createdAt: r.created_at.toISOString(),
    expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
    maxUses: r.max_uses,
    usesCount: r.uses_count,
  };
}

function newCode(): string {
  return randomBytes(12).toString('hex');
}

export class InvitesRepository {
  constructor(private readonly pool: Pool | null) {}

  async create(params: {
    courseId: string;
    createdByUserId: string | null;
    expiresAt: Date | null;
    maxUses: number | null;
  }): Promise<ContractsV1.InviteV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const id = randomUUID();
    const code = newCode();
    const res = await this.pool.query<InviteRow>(
      `
      INSERT INTO course_invites (id, course_id, code, expires_at, max_uses, uses_count, revoked_at, created_by_user_id, created_at)
      VALUES ($1, $2, $3, $4, $5, 0, NULL, $6, NOW())
      RETURNING *
      `,
      [id, params.courseId, code, params.expiresAt, params.maxUses, params.createdByUserId],
    );
    return mapRow(res.rows[0]);
  }

  async listByCourseId(courseId: string): Promise<ContractsV1.InviteV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<InviteRow>(
      `SELECT * FROM course_invites WHERE course_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [courseId],
    );
    return res.rows.map(mapRow);
  }

  async revoke(code: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    await this.pool.query(`UPDATE course_invites SET revoked_at = NOW() WHERE code = $1`, [code]);
  }

  async getByCode(code: string): Promise<InviteRow | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<InviteRow>(
      `SELECT * FROM course_invites WHERE code = $1 LIMIT 1`,
      [code],
    );
    return res.rows[0] ?? null;
  }

  async consume(code: string): Promise<InviteRow | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    // Attempt to atomically increase uses_count only if not revoked/expired/maxUses not exceeded.
    const res = await this.pool.query<InviteRow>(
      `
      UPDATE course_invites
      SET uses_count = uses_count + 1
      WHERE code = $1
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_uses IS NULL OR uses_count < max_uses)
      RETURNING *
      `,
      [code],
    );
    return res.rows[0] ?? null;
  }
}

