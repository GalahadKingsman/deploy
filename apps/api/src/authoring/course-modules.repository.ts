import { NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { ContractsV1, ErrorCodes } from '@tracked/shared';

interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: ModuleRow): ContractsV1.ExpertCourseModuleV1 {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    position: row.position,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class CourseModulesRepository {
  constructor(private readonly pool: Pool | null) {}

  async listByCourseId(courseId: string): Promise<ContractsV1.ExpertCourseModuleV1[]> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const result = await this.pool.query<ModuleRow>(
      `SELECT * FROM course_modules WHERE course_id = $1 AND deleted_at IS NULL ORDER BY position ASC, created_at ASC`,
      [courseId],
    );
    return result.rows.map(mapRow);
  }

  async create(params: { id: string; courseId: string; title: string }): Promise<ContractsV1.ExpertCourseModuleV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const posRes = await this.pool.query<{ max: number | null }>(
      `SELECT MAX(position) as max FROM course_modules WHERE course_id = $1 AND deleted_at IS NULL`,
      [params.courseId],
    );
    const next = (posRes.rows[0]?.max ?? -1) + 1;

    const result = await this.pool.query<ModuleRow>(
      `
      INSERT INTO course_modules (id, course_id, title, position, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
      `,
      [params.id, params.courseId, params.title.trim(), next],
    );
    return mapRow(result.rows[0]);
  }

  async update(params: {
    courseId: string;
    moduleId: string;
    patch: ContractsV1.UpdateExpertCourseModuleRequestV1;
  }): Promise<ContractsV1.ExpertCourseModuleV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const result = await this.pool.query<ModuleRow>(
      `
      UPDATE course_modules
      SET title = COALESCE($3, title), updated_at = NOW()
      WHERE id = $1 AND course_id = $2 AND deleted_at IS NULL
      RETURNING *
      `,
      [params.moduleId, params.courseId, params.patch.title?.trim() ?? null],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: ErrorCodes.COURSE_MODULE_NOT_FOUND,
        message: 'Course module not found',
      });
    }
    return mapRow(row);
  }

  async softDelete(params: { courseId: string; moduleId: string }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query(
      `UPDATE course_modules SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND course_id = $2 AND deleted_at IS NULL`,
      [params.moduleId, params.courseId],
    );
    if (res.rowCount === 0) {
      throw new NotFoundException({
        code: ErrorCodes.COURSE_MODULE_NOT_FOUND,
        message: 'Course module not found',
      });
    }
  }

  async reorder(params: { courseId: string; items: { id: string; position: number }[] }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    // simple implementation: update each row; client provides full desired order.
    for (const item of params.items) {
      await this.pool.query(
        `UPDATE course_modules SET position = $3, updated_at = NOW() WHERE id = $1 AND course_id = $2 AND deleted_at IS NULL`,
        [item.id, params.courseId, item.position],
      );
    }
  }
}

