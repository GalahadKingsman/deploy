import type { Pool, PoolClient } from 'pg';

export class ExpertMemberCourseAccessRepository {
  constructor(private readonly pool: Pool | null) {}

  async hasAccess(expertId: string, userId: string, courseId: string): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query<{ ok: number }>(
      `
      SELECT 1 AS ok
      FROM expert_member_course_access
      WHERE expert_id = $1 AND user_id = $2 AND course_id = $3
      LIMIT 1
      `,
      [expertId, userId, courseId],
    );
    return (res.rows[0]?.ok ?? 0) === 1;
  }

  async listCourseIdsForMember(expertId: string, userId: string): Promise<string[]> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query<{ course_id: string }>(
      `
      SELECT course_id
      FROM expert_member_course_access
      WHERE expert_id = $1 AND user_id = $2
      ORDER BY created_at ASC
      `,
      [expertId, userId],
    );
    return res.rows.map((r) => r.course_id);
  }

  async insertPairsForMember(
    client: PoolClient,
    expertId: string,
    userId: string,
    courseIds: string[],
  ): Promise<void> {
    for (const courseId of courseIds) {
      await client.query(
        `
        INSERT INTO expert_member_course_access (expert_id, user_id, course_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (expert_id, user_id, course_id) DO NOTHING
        `,
        [expertId, userId, courseId],
      );
    }
  }

  async grantAllNonDeletedCoursesForMember(client: PoolClient, expertId: string, userId: string): Promise<void> {
    await client.query(
      `
      INSERT INTO expert_member_course_access (expert_id, user_id, course_id, created_at)
      SELECT $1::uuid, $2::uuid, c.id, now()
      FROM courses c
      WHERE c.expert_id = $1::uuid AND c.deleted_at IS NULL
      ON CONFLICT (expert_id, user_id, course_id) DO NOTHING
      `,
      [expertId, userId],
    );
  }

  async deleteForMember(client: PoolClient, expertId: string, userId: string): Promise<void> {
    await client.query(`DELETE FROM expert_member_course_access WHERE expert_id = $1 AND user_id = $2`, [
      expertId,
      userId,
    ]);
  }

  async deleteAllForMember(expertId: string, userId: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    await this.pool.query(`DELETE FROM expert_member_course_access WHERE expert_id = $1 AND user_id = $2`, [
      expertId,
      userId,
    ]);
  }

  async insertPair(expertId: string, userId: string, courseId: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    await this.pool.query(
      `
      INSERT INTO expert_member_course_access (expert_id, user_id, course_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (expert_id, user_id, course_id) DO NOTHING
      `,
      [expertId, userId, courseId],
    );
  }

  async countForMember(expertId: string, userId: string): Promise<number> {
    if (!this.pool) return 0;
    const res = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM expert_member_course_access WHERE expert_id = $1 AND user_id = $2`,
      [expertId, userId],
    );
    return parseInt(res.rows[0]?.c ?? '0', 10) || 0;
  }
}
