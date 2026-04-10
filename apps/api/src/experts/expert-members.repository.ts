import { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';

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

    await this.pool.query('DELETE FROM expert_members WHERE expert_id = $1 AND user_id = $2', [
      expertId,
      userId,
    ]);
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
      SELECT em.user_id, em.role, em.created_at, u.username, u.first_name, u.last_name
      FROM expert_members em
      JOIN users u ON u.id = em.user_id
      WHERE em.expert_id = $1
      ORDER BY em.created_at ASC
      `,
      [expertId],
    );

    return result.rows.map((r) => ({
      userId: r.user_id,
      role: r.role as ContractsV1.ExpertMemberRoleV1,
      createdAt: r.created_at.toISOString(),
      username: r.username,
      firstName: r.first_name,
      lastName: r.last_name,
    }));
  }

  async countOwners(expertId: string): Promise<number> {
    if (!this.pool) return 0;
    const result = await this.pool.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM expert_members WHERE expert_id = $1 AND role = 'owner'`,
      [expertId],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10) || 0;
  }

  async listMembershipsByUserId(userId: string): Promise<ContractsV1.ExpertMemberV1[]> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const result = await this.pool.query<ExpertMemberDbRow>(
      'SELECT * FROM expert_members WHERE user_id = $1 ORDER BY created_at ASC',
      [userId],
    );
    return result.rows.map((r) => this.mapRow(r));
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
