import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ContractsV1 } from '@tracked/shared';

interface AssignmentFileRow {
  id: string;
  assignment_id: string;
  file_key: string;
  filename: string;
  content_type: string | null;
  created_at: Date;
}

function mapRow(r: AssignmentFileRow): ContractsV1.AssignmentFileV1 {
  return {
    id: r.id,
    assignmentId: r.assignment_id,
    fileKey: r.file_key,
    filename: r.filename,
    contentType: r.content_type ?? null,
    createdAt: r.created_at.toISOString(),
  };
}

export class AssignmentFilesRepository {
  constructor(private readonly pool: Pool | null) {}

  async listByAssignmentId(assignmentId: string): Promise<ContractsV1.AssignmentFileV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<AssignmentFileRow>(
      `SELECT * FROM assignment_files WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [assignmentId],
    );
    return res.rows.map(mapRow);
  }

  async findById(fileId: string): Promise<ContractsV1.AssignmentFileV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<AssignmentFileRow>(
      `SELECT * FROM assignment_files WHERE id = $1 LIMIT 1`,
      [fileId],
    );
    const row = res.rows[0];
    return row ? mapRow(row) : null;
  }

  async create(params: {
    assignmentId: string;
    fileKey: string;
    filename: string;
    contentType: string | null;
  }): Promise<ContractsV1.AssignmentFileV1> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const res = await this.pool.query<AssignmentFileRow>(
      `
      INSERT INTO assignment_files (id, assignment_id, file_key, filename, content_type, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
      `,
      [randomUUID(), params.assignmentId, params.fileKey, params.filename, params.contentType],
    );
    return mapRow(res.rows[0]);
  }

  async delete(fileId: string): Promise<{ ok: true } | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<{ id: string }>(
      `DELETE FROM assignment_files WHERE id = $1 RETURNING id`,
      [fileId],
    );
    return res.rows[0] ? { ok: true } : null;
  }
}

