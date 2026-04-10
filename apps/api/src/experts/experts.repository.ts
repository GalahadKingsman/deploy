import { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';

interface ExpertDbRow {
  id: string;
  title: string;
  slug: string | null;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}

export class ExpertsRepository {
  constructor(private readonly pool: Pool | null) {}

  async createExpert(data: {
    id: string;
    title: string;
    slug?: string | null;
    createdByUserId: string;
  }): Promise<ContractsV1.ExpertV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const query = `
      INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;
    const result = await this.pool.query<ExpertDbRow>(query, [
      data.id,
      data.title,
      data.slug ?? null,
      data.createdByUserId,
    ]);

    if (result.rows.length === 0) {
      throw new Error('Failed to create expert');
    }

    return this.mapRow(result.rows[0]);
  }

  async findExpertById(id: string): Promise<ContractsV1.ExpertV1 | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const result = await this.pool.query<ExpertDbRow>('SELECT * FROM experts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: ExpertDbRow): ContractsV1.ExpertV1 {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug ?? undefined,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
