import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ContractsV1 } from '@tracked/shared';

interface EnrollmentRow {
  id: string;
  user_id: string;
  course_id: string;
  access_end: Date | null;
  referral_code: string | null;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(r: EnrollmentRow): ContractsV1.EnrollmentV1 {
  return {
    id: r.id,
    userId: r.user_id,
    courseId: r.course_id,
    accessEnd: r.access_end ? r.access_end.toISOString() : null,
    revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export class EnrollmentsRepository {
  constructor(private readonly pool: Pool | null) {}

  async countByReferralCode(params: { referralCode: string }): Promise<number> {
    if (!this.pool) return 0;
    const res = await this.pool.query<{ cnt: string }>(
      `
      SELECT COUNT(*)::text AS cnt
      FROM enrollments
      WHERE referral_code = $1
        AND revoked_at IS NULL
      `,
      [params.referralCode],
    );
    return parseInt(res.rows[0]?.cnt ?? '0', 10) || 0;
  }

  async upsertActive(params: {
    userId: string;
    courseId: string;
    accessEnd: Date | null;
    referralCode?: string | null;
  }): Promise<ContractsV1.EnrollmentV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const id = randomUUID();
    const res = await this.pool.query<EnrollmentRow>(
      `
      INSERT INTO enrollments (id, user_id, course_id, access_end, referral_code, revoked_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NULL, NOW(), NOW())
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET
        access_end = EXCLUDED.access_end,
        referral_code = COALESCE(enrollments.referral_code, EXCLUDED.referral_code),
        revoked_at = NULL,
        updated_at = NOW()
      RETURNING *
      `,
      [id, params.userId, params.courseId, params.accessEnd, params.referralCode ?? null],
    );
    return mapRow(res.rows[0]);
  }

  async listMyActiveCourseIds(userId: string): Promise<string[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<{ course_id: string; access_end: Date | null }>(
      `
      SELECT course_id, access_end
      FROM enrollments
      WHERE user_id = $1
        AND revoked_at IS NULL
        AND (access_end IS NULL OR access_end > NOW())
      ORDER BY updated_at DESC
      `,
      [userId],
    );
    return res.rows.map((r) => r.course_id);
  }

  async hasActiveAccess(params: { userId: string; courseId: string }): Promise<boolean> {
    if (!this.pool) return false;
    const res = await this.pool.query(
      `
      SELECT 1
      FROM enrollments
      WHERE user_id = $1 AND course_id = $2
        AND revoked_at IS NULL
        AND (access_end IS NULL OR access_end > NOW())
      LIMIT 1
      `,
      [params.userId, params.courseId],
    );
    return res.rows.length > 0;
  }

  async findById(enrollmentId: string): Promise<ContractsV1.EnrollmentV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<EnrollmentRow>(
      `SELECT * FROM enrollments WHERE id = $1 LIMIT 1`,
      [enrollmentId],
    );
    const r = res.rows[0];
    return r ? mapRow(r) : null;
  }

  async listForCourseWithStudents(courseId: string): Promise<ContractsV1.ExpertEnrollmentRowV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<
      EnrollmentRow & { telegram_user_id: string; username: string | null }
    >(
      `
      SELECT e.id, e.user_id, e.course_id, e.access_end, e.referral_code, e.revoked_at,
             e.created_at, e.updated_at,
             u.telegram_user_id, u.username
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      WHERE e.course_id = $1
      ORDER BY e.created_at DESC
      LIMIT 500
      `,
      [courseId],
    );
    return res.rows.map((row) => ({
      enrollment: mapRow(row),
      studentTelegramUserId: row.telegram_user_id,
      studentUsername: row.username,
    }));
  }

  async extendByGrantDays(enrollmentId: string, grantDays: number): Promise<ContractsV1.EnrollmentV1 | null> {
    if (!this.pool) return null;
    const days = Math.min(Math.max(1, grantDays), 3650);
    const res = await this.pool.query<EnrollmentRow>(
      `
      UPDATE enrollments
      SET
        access_end = CASE
          WHEN access_end IS NULL OR access_end < NOW() THEN NOW() + ($2::int * INTERVAL '1 day')
          ELSE access_end + ($2::int * INTERVAL '1 day')
        END,
        revoked_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [enrollmentId, days],
    );
    const r = res.rows[0];
    return r ? mapRow(r) : null;
  }

  async revokeEnrollment(enrollmentId: string): Promise<ContractsV1.EnrollmentV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<EnrollmentRow>(
      `
      UPDATE enrollments
      SET revoked_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [enrollmentId],
    );
    const r = res.rows[0];
    return r ? mapRow(r) : null;
  }
}

