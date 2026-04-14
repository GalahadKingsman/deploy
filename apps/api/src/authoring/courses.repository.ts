import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import type { ExpertsRepository } from '../experts/experts.repository.js';

type CourseStatus = ContractsV1.CourseStatusV1;
type CourseVisibility = ContractsV1.CourseVisibilityV1;

interface CourseRow {
  id: string;
  expert_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents?: number | null;
  currency?: string | null;
  status: string;
  visibility: string;
  published_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: CourseRow): ContractsV1.ExpertCourseV1 {
  return {
    id: row.id,
    expertId: row.expert_id,
    title: row.title,
    description: row.description ?? null,
    coverUrl: row.cover_url ?? null,
    priceCents: row.price_cents ?? 0,
    currency: row.currency ?? 'RUB',
    status: row.status as CourseStatus,
    visibility: row.visibility as CourseVisibility,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class CoursesRepository {
  constructor(
    private readonly pool: Pool | null,
    private readonly expertsRepository: ExpertsRepository,
  ) {}

  async assertModuleBelongsToExpert(params: { expertId: string; moduleId: string }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query<{ ok: boolean }>(
      `
      SELECT 1 as ok
      FROM course_modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = $1
        AND m.deleted_at IS NULL
        AND c.expert_id = $2
        AND c.deleted_at IS NULL
      LIMIT 1
      `,
      [params.moduleId, params.expertId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException({
        code: ErrorCodes.COURSE_MODULE_NOT_FOUND,
        message: 'Course module not found',
      });
    }
  }

  async listByExpertId(params: {
    expertId: string;
    status?: CourseStatus;
    includeDeleted?: boolean;
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContractsV1.ExpertCourseV1[]> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    const conditions: string[] = ['expert_id = $1'];
    const values: unknown[] = [params.expertId];
    let i = 2;

    if (!params.includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }

    if (params.status) {
      conditions.push(`status = $${i}`);
      values.push(params.status);
      i += 1;
    }

    if (params.query && params.query.trim()) {
      conditions.push(`title ILIKE $${i}`);
      values.push(`%${params.query.trim()}%`);
      i += 1;
    }

    values.push(limit, offset);

    const result = await this.pool.query<CourseRow>(
      `
      SELECT *
      FROM courses
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC
      LIMIT $${i} OFFSET $${i + 1}
      `,
      values,
    );

    return result.rows.map(mapRow);
  }

  async getById(params: { expertId: string; courseId: string }): Promise<ContractsV1.ExpertCourseV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const result = await this.pool.query<CourseRow>(
      `SELECT * FROM courses WHERE id = $1 AND expert_id = $2`,
      [params.courseId, params.expertId],
    );
    const row = result.rows[0];
    if (!row || row.deleted_at) {
      throw new NotFoundException({
        code: ErrorCodes.COURSE_NOT_FOUND,
        message: 'Course not found',
      });
    }
    return mapRow(row);
  }

  async create(params: {
    expertId: string;
    id: string;
    title: string;
    description?: string | null;
    coverUrl?: string | null;
    priceCents: number;
    currency: string;
    visibility: CourseVisibility;
  }): Promise<ContractsV1.ExpertCourseV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const expert = await this.expertsRepository.findExpertById(params.expertId);
    if (!expert) {
      throw new NotFoundException({ code: ErrorCodes.EXPERT_NOT_FOUND, message: 'Expert not found' });
    }

    const result = await this.pool.query<CourseRow>(
      `
      INSERT INTO courses (id, expert_id, title, description, cover_url, price_cents, currency, status, visibility, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, NOW(), NOW())
      RETURNING *
      `,
      [
        params.id,
        params.expertId,
        params.title.trim(),
        params.description ?? null,
        params.coverUrl ?? null,
        params.priceCents,
        params.currency,
        params.visibility,
      ],
    );
    return mapRow(result.rows[0]);
  }

  async update(params: {
    expertId: string;
    courseId: string;
    patch: ContractsV1.UpdateExpertCourseRequestV1;
  }): Promise<ContractsV1.ExpertCourseV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    // Ensure exists (and not deleted)
    await this.getById({ expertId: params.expertId, courseId: params.courseId });

    const title = params.patch.title?.trim();
    if (params.patch.title !== undefined && (!title || title.length === 0)) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'title must be non-empty' });
    }

    const priceCents =
      params.patch.priceCents === undefined ? null : params.patch.priceCents;
    const currency = params.patch.currency === undefined ? null : params.patch.currency.trim();

    const result = await this.pool.query<CourseRow>(
      `
      UPDATE courses
      SET
        title = COALESCE($3, title),
        description = COALESCE($4, description),
        cover_url = COALESCE($5, cover_url),
        visibility = COALESCE($6, visibility),
        price_cents = COALESCE($7, price_cents),
        currency = COALESCE($8, currency),
        updated_at = NOW()
      WHERE id = $1 AND expert_id = $2
      RETURNING *
      `,
      [
        params.courseId,
        params.expertId,
        title ?? null,
        params.patch.description === undefined ? null : params.patch.description,
        params.patch.coverUrl === undefined ? null : params.patch.coverUrl,
        params.patch.visibility ?? null,
        priceCents,
        currency || null,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({ code: ErrorCodes.COURSE_NOT_FOUND, message: 'Course not found' });
    }
    return mapRow(row);
  }

  async publish(params: { expertId: string; courseId: string }): Promise<ContractsV1.ExpertCourseV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    await this.getById(params);
    const result = await this.pool.query<CourseRow>(
      `
      UPDATE courses
      SET
        status = 'published',
        visibility = 'public',
        published_at = COALESCE(published_at, NOW()),
        updated_at = NOW()
      WHERE id = $1 AND expert_id = $2
      RETURNING *
      `,
      [params.courseId, params.expertId],
    );
    return mapRow(result.rows[0]);
  }

  async unpublish(params: { expertId: string; courseId: string }): Promise<ContractsV1.ExpertCourseV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    await this.getById(params);
    const result = await this.pool.query<CourseRow>(
      `
      UPDATE courses
      SET status = 'draft', published_at = NULL, updated_at = NOW()
      WHERE id = $1 AND expert_id = $2
      RETURNING *
      `,
      [params.courseId, params.expertId],
    );
    return mapRow(result.rows[0]);
  }

  async softDelete(params: { expertId: string; courseId: string }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    await this.getById(params);
    await this.pool.query(
      `UPDATE courses SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND expert_id = $2`,
      [params.courseId, params.expertId],
    );
  }
}

