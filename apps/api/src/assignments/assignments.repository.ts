import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ContractsV1 } from '@tracked/shared';

interface AssignmentRow {
  id: string;
  lesson_id: string;
  prompt_md: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(r: AssignmentRow): ContractsV1.AssignmentV1 {
  return {
    id: r.id,
    lessonId: r.lesson_id,
    promptMarkdown: r.prompt_md ?? null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export class AssignmentsRepository {
  constructor(private readonly pool: Pool | null) {}

  async ensureByLessonId(lessonId: string): Promise<ContractsV1.AssignmentV1> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    // Create a row if missing; never overwrite prompt_md.
    const inserted = await this.pool.query<AssignmentRow>(
      `
      INSERT INTO assignments (id, lesson_id, prompt_md, created_at, updated_at)
      VALUES ($1, $2, NULL, NOW(), NOW())
      ON CONFLICT (lesson_id) DO UPDATE
        SET updated_at = assignments.updated_at
      RETURNING *
      `,
      [randomUUID(), lessonId],
    );
    return mapRow(inserted.rows[0]);
  }

  async upsertByLessonId(params: {
    lessonId: string;
    promptMarkdown: string | null;
  }): Promise<ContractsV1.AssignmentV1> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const existing = await this.pool.query<AssignmentRow>(
      `SELECT * FROM assignments WHERE lesson_id = $1 LIMIT 1`,
      [params.lessonId],
    );
    if (existing.rows[0]) {
      const updated = await this.pool.query<AssignmentRow>(
        `
        UPDATE assignments
        SET prompt_md = $2, updated_at = NOW()
        WHERE lesson_id = $1
        RETURNING *
        `,
        [params.lessonId, params.promptMarkdown],
      );
      return mapRow(updated.rows[0]);
    }
    const created = await this.pool.query<AssignmentRow>(
      `
      INSERT INTO assignments (id, lesson_id, prompt_md, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *
      `,
      [randomUUID(), params.lessonId, params.promptMarkdown],
    );
    return mapRow(created.rows[0]);
  }

  async getByLessonId(lessonId: string): Promise<ContractsV1.AssignmentV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<AssignmentRow>(
      `SELECT * FROM assignments WHERE lesson_id = $1 LIMIT 1`,
      [lessonId],
    );
    const row = res.rows[0];
    return row ? mapRow(row) : null;
  }
}

