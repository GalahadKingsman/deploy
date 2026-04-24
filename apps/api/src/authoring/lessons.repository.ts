import { NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { ContractsV1, ErrorCodes } from '@tracked/shared';

interface LessonRow {
  id: string;
  module_id: string;
  title: string;
  content_md: string | null;
  slider: unknown | null;
  position: number;
  video: unknown | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ModuleCourseRow {
  id: string;
  course_id: string;
}

function mapRow(row: LessonRow, courseId: string): ContractsV1.ExpertLessonV1 {
  return {
    id: row.id,
    courseId,
    moduleId: row.module_id,
    title: row.title,
    position: row.position,
    contentMarkdown: row.content_md ?? null,
    slider: (row.slider as any) ?? null,
    // video is stored as jsonb, expected to conform to LessonVideoV1 (validated on write)
    video: (row.video as any) ?? undefined,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class LessonsRepository {
  constructor(private readonly pool: Pool | null) {}

  private async resolveCourseIdByModuleId(moduleId: string): Promise<string> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query<ModuleCourseRow>(
      `SELECT id, course_id FROM course_modules WHERE id = $1 AND deleted_at IS NULL`,
      [moduleId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: ErrorCodes.COURSE_MODULE_NOT_FOUND,
        message: 'Course module not found',
      });
    }
    return row.course_id;
  }

  async getTitleForExpertLesson(params: { expertId: string; lessonId: string }): Promise<string | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<{ title: string }>(
      `
      SELECT l.title
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = $1
        AND l.deleted_at IS NULL
        AND m.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND c.expert_id = $2
      LIMIT 1
      `,
      [params.lessonId, params.expertId],
    );
    return res.rows[0]?.title ?? null;
  }

  async assertLessonBelongsToExpert(params: { expertId: string; lessonId: string }): Promise<{ courseId: string }> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query<{ course_id: string }>(
      `
      SELECT m.course_id
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE l.id = $1
        AND l.deleted_at IS NULL
        AND m.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND c.expert_id = $2
      LIMIT 1
      `,
      [params.lessonId, params.expertId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException({ code: ErrorCodes.LESSON_NOT_FOUND, message: 'Lesson not found' });
    }
    return { courseId: row.course_id };
  }

  async listByModuleId(moduleId: string): Promise<ContractsV1.ExpertLessonV1[]> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const courseId = await this.resolveCourseIdByModuleId(moduleId);
    const result = await this.pool.query<LessonRow>(
      `SELECT * FROM lessons WHERE module_id = $1 AND deleted_at IS NULL ORDER BY position ASC, created_at ASC`,
      [moduleId],
    );
    return result.rows.map((r) => mapRow(r, courseId));
  }

  async create(params: {
    id: string;
    moduleId: string;
    title: string;
    contentMarkdown?: string | null;
    slider?: { images: { key: string }[] } | null;
    video?: ContractsV1.LessonVideoV1;
  }): Promise<ContractsV1.ExpertLessonV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const courseId = await this.resolveCourseIdByModuleId(params.moduleId);

    const posRes = await this.pool.query<{ max: number | null }>(
      `SELECT MAX(position) as max FROM lessons WHERE module_id = $1 AND deleted_at IS NULL`,
      [params.moduleId],
    );
    const next = (posRes.rows[0]?.max ?? -1) + 1;

    const result = await this.pool.query<LessonRow>(
      `
      INSERT INTO lessons (id, module_id, title, content_md, slider, position, video, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, NOW(), NOW())
      RETURNING *
      `,
      [
        params.id,
        params.moduleId,
        params.title.trim(),
        params.contentMarkdown ?? null,
        params.slider ? JSON.stringify(params.slider) : null,
        next,
        params.video ? JSON.stringify(params.video) : null,
      ],
    );
    return mapRow(result.rows[0], courseId);
  }

  async update(params: {
    moduleId: string;
    lessonId: string;
    patch: ContractsV1.UpdateExpertLessonRequestV1;
  }): Promise<ContractsV1.ExpertLessonV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const courseId = await this.resolveCourseIdByModuleId(params.moduleId);

    const result = await this.pool.query<LessonRow>(
      `
      UPDATE lessons
      SET
        title = COALESCE($3, title),
        content_md = COALESCE($4, content_md),
        slider = COALESCE($5::jsonb, slider),
        video = COALESCE($6::jsonb, video),
        updated_at = NOW()
      WHERE id = $1 AND module_id = $2 AND deleted_at IS NULL
      RETURNING *
      `,
      [
        params.lessonId,
        params.moduleId,
        params.patch.title?.trim() ?? null,
        params.patch.contentMarkdown === undefined ? null : params.patch.contentMarkdown,
        params.patch.slider === undefined ? null : JSON.stringify(params.patch.slider),
        params.patch.video === undefined ? null : JSON.stringify(params.patch.video),
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({ code: ErrorCodes.LESSON_NOT_FOUND, message: 'Lesson not found' });
    }
    return mapRow(row, courseId);
  }

  async softDelete(params: { moduleId: string; lessonId: string }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query(
      `UPDATE lessons SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND module_id = $2 AND deleted_at IS NULL`,
      [params.lessonId, params.moduleId],
    );
    if (res.rowCount === 0) {
      throw new NotFoundException({ code: ErrorCodes.LESSON_NOT_FOUND, message: 'Lesson not found' });
    }
  }

  async reorder(params: { moduleId: string; items: { id: string; position: number }[] }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    for (const item of params.items) {
      await this.pool.query(
        `UPDATE lessons SET position = $3, updated_at = NOW() WHERE id = $1 AND module_id = $2 AND deleted_at IS NULL`,
        [item.id, params.moduleId, item.position],
      );
    }
  }
}

