import type { Pool, PoolClient } from 'pg';
import type { ContractsV1 } from '@tracked/shared';

function formatCoursesLabelRu(role: string, courseAccessCount: number): string {
  if (role === 'owner') {
    return 'Все курсы';
  }
  const n = courseAccessCount;
  if (n === 0) {
    return 'Нет курсов';
  }
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) {
    return `${n} курсов`;
  }
  if (mod10 === 1) {
    return `${n} курс`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${n} курса`;
  }
  return `${n} курсов`;
}

interface ExpertMemberDbRow {
  expert_id: string;
  user_id: string;
  role: string;
  created_at: Date;
}

interface ExpertTeamMemberRow {
  user_id: string;
  role: string;
  created_at: Date;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  updated_at: Date;
  course_access_count: string;
  is_workspace_creator: boolean;
}

export class ExpertMembersRepository {
  constructor(private readonly pool: Pool | null) {}

  async addMember(data: {
    expertId: string;
    userId: string;
    role: ContractsV1.ExpertMemberRoleV1;
  }): Promise<ContractsV1.ExpertMemberV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const query = `
      INSERT INTO expert_members (expert_id, user_id, role)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await this.pool.query<ExpertMemberDbRow>(query, [
      data.expertId,
      data.userId,
      data.role,
    ]);

    if (result.rows.length === 0) {
      throw new Error('Failed to add member');
    }

    return this.mapRow(result.rows[0]);
  }

  async addMemberWithClient(
    client: PoolClient,
    data: {
      expertId: string;
      userId: string;
      role: ContractsV1.ExpertMemberRoleV1;
    },
  ): Promise<ContractsV1.ExpertMemberV1> {
    const query = `
      INSERT INTO expert_members (expert_id, user_id, role)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await client.query<ExpertMemberDbRow>(query, [data.expertId, data.userId, data.role]);

    if (result.rows.length === 0) {
      throw new Error('Failed to add member');
    }

    return this.mapRow(result.rows[0]);
  }

  async findMember(expertId: string, userId: string): Promise<ContractsV1.ExpertMemberV1 | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const result = await this.pool.query<ExpertMemberDbRow>(
      'SELECT * FROM expert_members WHERE expert_id = $1 AND user_id = $2',
      [expertId, userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async updateMemberRole(
    expertId: string,
    userId: string,
    role: ContractsV1.ExpertMemberRoleV1,
  ): Promise<ContractsV1.ExpertMemberV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const query = `
      UPDATE expert_members
      SET role = $3
      WHERE expert_id = $1 AND user_id = $2
      RETURNING *
    `;
    const result = await this.pool.query<ExpertMemberDbRow>(query, [expertId, userId, role]);

    if (result.rows.length === 0) {
      throw new Error('Member not found');
    }

    return this.mapRow(result.rows[0]);
  }

  async removeMember(expertId: string, userId: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM expert_member_course_access WHERE expert_id = $1 AND user_id = $2`, [
        expertId,
        userId,
      ]);
      await client.query('DELETE FROM expert_members WHERE expert_id = $1 AND user_id = $2', [expertId, userId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async listMembers(expertId: string): Promise<ContractsV1.ExpertMemberV1[]> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const result = await this.pool.query<ExpertMemberDbRow>(
      'SELECT * FROM expert_members WHERE expert_id = $1 ORDER BY created_at ASC',
      [expertId],
    );

    return result.rows.map((r) => this.mapRow(r));
  }

  async listTeamMembersPublic(expertId: string): Promise<ContractsV1.ExpertTeamMemberV1[]> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const result = await this.pool.query<ExpertTeamMemberRow>(
      `
      SELECT em.user_id, em.role, em.created_at, u.username, u.first_name, u.last_name, u.email, u.updated_at,
        COALESCE(acc.n, 0)::text AS course_access_count,
        (e.created_by_user_id IS NOT NULL AND e.created_by_user_id = em.user_id) AS is_workspace_creator
      FROM expert_members em
      JOIN users u ON u.id = em.user_id
      JOIN experts e ON e.id = em.expert_id
      LEFT JOIN (
        SELECT expert_id, user_id, COUNT(*)::int AS n
        FROM expert_member_course_access
        GROUP BY expert_id, user_id
      ) acc ON acc.expert_id = em.expert_id AND acc.user_id = em.user_id
      WHERE em.expert_id = $1
      ORDER BY em.created_at ASC
      `,
      [expertId],
    );

    return result.rows.map((r) => {
      const courseAccessCount = parseInt(r.course_access_count, 10) || 0;
      return {
        userId: r.user_id,
        role: r.role as ContractsV1.ExpertMemberRoleV1,
        createdAt: r.created_at.toISOString(),
        username: r.username,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        coursesLabel: formatCoursesLabelRu(r.role, courseAccessCount),
        lastActivityAt: r.updated_at ? r.updated_at.toISOString() : null,
        isWorkspaceCreator: r.is_workspace_creator,
      };
    });
  }

  async countOwners(expertId: string): Promise<number> {
    if (!this.pool) return 0;
    const result = await this.pool.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM expert_members WHERE expert_id = $1 AND role = 'owner'`,
      [expertId],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10) || 0;
  }

  async countMembersForExpert(expertId: string): Promise<number> {
    if (!this.pool) return 0;
    const result = await this.pool.query<{ c: string }>(
      'SELECT COUNT(*)::text AS c FROM expert_members WHERE expert_id = $1',
      [expertId],
    );
    return parseInt(result.rows[0]?.c ?? '0', 10) || 0;
  }

  async listMembershipsByUserId(userId: string): Promise<ContractsV1.ExpertMemberV1[]> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const result = await this.pool.query<
      ExpertMemberDbRow & { is_workspace_creator: boolean }
    >(
      `
      SELECT em.expert_id, em.user_id, em.role, em.created_at,
        (e.created_by_user_id IS NOT NULL AND e.created_by_user_id = em.user_id) AS is_workspace_creator
      FROM expert_members em
      JOIN experts e ON e.id = em.expert_id
      WHERE em.user_id = $1
      ORDER BY em.created_at ASC
      `,
      [userId],
    );
    return result.rows.map((r) => ({
      ...this.mapRow(r),
      isWorkspaceCreator: r.is_workspace_creator,
    }));
  }

  private mapRow(row: ExpertMemberDbRow): ContractsV1.ExpertMemberV1 {
    return {
      expertId: row.expert_id,
      userId: row.user_id,
      role: row.role as ContractsV1.ExpertMemberRoleV1,
      createdAt: row.created_at.toISOString(),
    };
  }
}
