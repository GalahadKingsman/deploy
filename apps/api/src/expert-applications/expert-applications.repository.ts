import { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';

interface ExpertApplicationDbRow {
  id: string;
  user_id: string;
  status: string;
  note: string | null;
  admin_note: string | null;
  created_at: Date;
  updated_at: Date;
  decided_at: Date | null;
  decided_by_user_id: string | null;
}

function mapRow(row: ExpertApplicationDbRow): ContractsV1.ExpertApplicationV1 {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status as ContractsV1.ExpertApplicationStatusV1,
    note: row.note,
    adminNote: row.admin_note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
    decidedByUserId: row.decided_by_user_id,
  };
}

export class ExpertApplicationsRepository {
  constructor(private readonly pool: Pool | null) {}

  async getByUserId(userId: string): Promise<ContractsV1.ExpertApplicationV1 | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const result = await this.pool.query<ExpertApplicationDbRow>(
      'SELECT * FROM expert_applications WHERE user_id = $1',
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRow(result.rows[0]);
  }

  /**
   * Upsert expert application: create pending, update pending note, or resubmit from rejected.
   * If approved → return existing without change.
   */
  async upsertPending(
    userId: string,
    note: string | null,
  ): Promise<ContractsV1.ExpertApplicationV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const existing = await this.getByUserId(userId);

    if (!existing) {
      const insert = await this.pool.query<ExpertApplicationDbRow>(
        `INSERT INTO expert_applications (user_id, status, note, created_at, updated_at)
         VALUES ($1, 'pending', $2, NOW(), NOW())
         RETURNING *`,
        [userId, note ?? null],
      );
      return mapRow(insert.rows[0]);
    }

    if (existing.status === 'approved') {
      return existing;
    }

    if (existing.status === 'pending') {
      const update = await this.pool.query<ExpertApplicationDbRow>(
        `UPDATE expert_applications SET note = $2, updated_at = NOW() WHERE user_id = $1 RETURNING *`,
        [userId, note ?? existing.note],
      );
      return mapRow(update.rows[0]);
    }

    // rejected → resubmit: set pending, clear decided_*, update note
    const update = await this.pool.query<ExpertApplicationDbRow>(
      `UPDATE expert_applications
       SET status = 'pending', note = $2, admin_note = NULL, updated_at = NOW(),
           decided_at = NULL, decided_by_user_id = NULL
       WHERE user_id = $1 RETURNING *`,
      [userId, note ?? existing.note],
    );
    return mapRow(update.rows[0]);
  }
}
