import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ContractsV1 } from '@tracked/shared';

interface LessonMaterialFileRow {
  id: string;
  lesson_id: string;
  file_key: string;
  filename: string;
  content_type: string | null;
  size_bytes: string | number | null;
  created_at: Date;
}

function mapRow(r: LessonMaterialFileRow): ContractsV1.LessonMaterialFileV1 {
  return {
    id: r.id,
    lessonId: r.lesson_id,
    fileKey: r.file_key,
    filename: r.filename,
    contentType: r.content_type ?? null,
    sizeBytes:
      r.size_bytes == null
        ? null
        : typeof r.size_bytes === 'number'
          ? r.size_bytes
          : Number(r.size_bytes),
    createdAt: r.created_at.toISOString(),
  };
}

export class LessonMaterialFilesRepository {
  constructor(private readonly pool: Pool | null) {}

  async listByLessonId(lessonId: string): Promise<ContractsV1.LessonMaterialFileV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<LessonMaterialFileRow>(
      `SELECT * FROM lesson_material_files WHERE lesson_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [lessonId],
    );
    return res.rows.map(mapRow);
  }

  async findById(fileId: string): Promise<ContractsV1.LessonMaterialFileV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<LessonMaterialFileRow>(
      `SELECT * FROM lesson_material_files WHERE id = $1 LIMIT 1`,
      [fileId],
    );
    const row = res.rows[0];
    return row ? mapRow(row) : null;
  }

  async create(params: {
    lessonId: string;
    fileKey: string;
    filename: string;
    contentType: string | null;
    sizeBytes: number | null;
  }): Promise<ContractsV1.LessonMaterialFileV1> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const res = await this.pool.query<LessonMaterialFileRow>(
      `
      INSERT INTO lesson_material_files (id, lesson_id, file_key, filename, content_type, size_bytes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
      `,
      [randomUUID(), params.lessonId, params.fileKey, params.filename, params.contentType, params.sizeBytes],
    );
    return mapRow(res.rows[0]);
  }

  async delete(fileId: string): Promise<{ ok: true } | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<{ id: string }>(
      `DELETE FROM lesson_material_files WHERE id = $1 RETURNING id`,
      [fileId],
    );
    return res.rows[0] ? { ok: true } : null;
  }
}

