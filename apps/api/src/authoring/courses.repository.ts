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
  author_display_name?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  status: string;
  visibility: string;
  lesson_access_mode: string;
  published_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function trimAuthorDisplayName(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  return s ? s.slice(0, 240) : null;
}

function mapRow(row: CourseRow): ContractsV1.ExpertCourseV1 {
  const mode = row.lesson_access_mode;
  return {
    id: row.id,
    expertId: row.expert_id,
    title: row.title,
    description: row.description ?? null,
    coverUrl: row.cover_url ?? null,
    authorDisplayName: trimAuthorDisplayName(row.author_display_name ?? null),
    priceCents: row.price_cents ?? 0,
    currency: row.currency ?? 'RUB',
    status: row.status as CourseStatus,
    visibility: row.visibility as CourseVisibility,
    lessonAccessMode: mode === 'open' ? 'open' : 'sequential',
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function parseIntCol(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  const n = parseInt(String(v ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseAvgPct(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? Math.round(n) : null;
}

interface CourseDashboardSqlRow extends CourseRow {
  modules_count: unknown;
  lessons_count: unknown;
  active_students_count: unknown;
  avg_completion_percent: unknown;
}

function mapDashboardRow(row: CourseDashboardSqlRow): ContractsV1.ExpertCourseDashboardItemV1 {
  const base = mapRow(row);
  const modulesCount = parseIntCol(row.modules_count);
  const lessonsCount = parseIntCol(row.lessons_count);
  const activeStudentsCount = parseIntCol(row.active_students_count);
  const rawAvg = parseAvgPct(row.avg_completion_percent);
  const avgCompletionPercent =
    (base.status === 'published' || base.status === 'archived') &&
    lessonsCount > 0 &&
    activeStudentsCount > 0
      ? rawAvg
      : null;
  return {
    ...base,
    modulesCount,
    lessonsCount,
    activeStudentsCount,
    avgCompletionPercent,
  };
}

export class CoursesRepository {
  constructor(
    private readonly pool: Pool | null,
    private readonly expertsRepository: ExpertsRepository,
  ) {}

  async assertModuleBelongsToExpert(params: {
    expertId: string;
    moduleId: string;
  }): Promise<{ courseId: string }> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const res = await this.pool.query<{ course_id: string }>(
      `
      SELECT m.course_id
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
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: ErrorCodes.COURSE_MODULE_NOT_FOUND,
        message: 'Course module not found',
      });
    }
    return { courseId: row.course_id };
  }

  /** When set, only these course ids are returned (e.g. expert team member scope). */
  async assertAllCoursesBelongToExpert(expertId: string, courseIds: string[]): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    if (courseIds.length === 0) {
      return;
    }
    const res = await this.pool.query<{ id: string }>(
      `
      SELECT id
      FROM courses
      WHERE expert_id = $1
        AND deleted_at IS NULL
        AND id = ANY($2::uuid[])
      `,
      [expertId, courseIds],
    );
    if (res.rows.length !== courseIds.length) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'One or more courses are invalid for this expert',
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
    /**
     * When set, restrict listing to these course ids (non-owner expert team scope).
     * Empty array means no courses (result set empty). Omitted = no restriction (e.g. owner).
     */
    restrictToCourseIds?: string[];
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

    if (params.restrictToCourseIds !== undefined) {
      if (params.restrictToCourseIds.length === 0) {
        conditions.push('FALSE');
      } else {
        conditions.push(`id = ANY($${i}::uuid[])`);
        values.push(params.restrictToCourseIds);
        i += 1;
      }
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

  /**
   * Expert «Мои курсы» cards: module/lesson/student counts + mean completion % (same completion rules as student progress).
   */
  async listDashboardByExpertId(params: {
    expertId: string;
    status?: CourseStatus;
    query?: string;
    limit?: number;
    offset?: number;
    restrictToCourseIds?: string[];
  }): Promise<ContractsV1.ExpertCourseDashboardItemV1[]> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    const conditions: string[] = ['c.expert_id = $1', 'c.deleted_at IS NULL'];
    const values: unknown[] = [params.expertId];
    let i = 2;

    if (params.status) {
      conditions.push(`c.status = $${i}`);
      values.push(params.status);
      i += 1;
    }

    if (params.query && params.query.trim()) {
      conditions.push(`c.title ILIKE $${i}`);
      values.push(`%${params.query.trim()}%`);
      i += 1;
    }

    if (params.restrictToCourseIds !== undefined) {
      if (params.restrictToCourseIds.length === 0) {
        conditions.push('FALSE');
      } else {
        conditions.push(`c.id = ANY($${i}::uuid[])`);
        values.push(params.restrictToCourseIds);
        i += 1;
      }
    }

    values.push(limit, offset);

    const result = await this.pool.query<CourseDashboardSqlRow>(
      `
      SELECT
        c.*,
        COALESCE(mc.cnt, 0)::int AS modules_count,
        COALESCE(lc.cnt, 0)::int AS lessons_count,
        COALESCE(ec.cnt, 0)::int AS active_students_count,
        (
          SELECT ROUND(AVG(per.pct))::int
          FROM (
            SELECT
              CASE
                WHEN COALESCE(lc_inner.cnt, 0) = 0 THEN NULL
                ELSE LEAST(
                  100,
                  ROUND((100.0 * COALESCE(cd.done_cnt, 0) / NULLIF(lc_inner.cnt, 0)))::numeric
                )::int
              END AS pct
            FROM enrollments e
            LEFT JOIN (
              SELECT cl.user_id, COUNT(DISTINCT cl.lesson_id)::int AS done_cnt
              FROM (
                SELECT p.user_id, p.lesson_id
                FROM lesson_progress p
                JOIN lessons l ON l.id = p.lesson_id AND l.deleted_at IS NULL AND l.hidden_from_students = false
                JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
                WHERE m.course_id = c.id
                UNION ALL
                SELECT s.student_user_id AS user_id, a.lesson_id
                FROM submissions s
                JOIN assignments a ON a.id = s.assignment_id
                JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL AND l.hidden_from_students = false
                JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
                WHERE m.course_id = c.id AND s.status = 'accepted'
              ) cl
              GROUP BY cl.user_id
            ) cd ON cd.user_id = e.user_id
            CROSS JOIN (
              SELECT COUNT(l.id)::int AS cnt
              FROM lessons l
              JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
              WHERE m.course_id = c.id AND l.deleted_at IS NULL AND l.hidden_from_students = false
            ) lc_inner
            WHERE e.course_id = c.id
              AND e.revoked_at IS NULL
              AND (e.access_end IS NULL OR e.access_end > NOW())
          ) per
          WHERE per.pct IS NOT NULL
        ) AS avg_completion_percent
      FROM courses c
      LEFT JOIN (
        SELECT course_id, COUNT(*)::int AS cnt
        FROM course_modules
        WHERE deleted_at IS NULL
        GROUP BY course_id
      ) mc ON mc.course_id = c.id
      LEFT JOIN (
        SELECT m.course_id, COUNT(l.id)::int AS cnt
        FROM lessons l
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        WHERE l.deleted_at IS NULL
        GROUP BY m.course_id
      ) lc ON lc.course_id = c.id
      LEFT JOIN (
        SELECT course_id, COUNT(*)::int AS cnt
        FROM enrollments
        WHERE revoked_at IS NULL AND (access_end IS NULL OR access_end > NOW())
        GROUP BY course_id
      ) ec ON ec.course_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.updated_at DESC
      LIMIT $${i} OFFSET $${i + 1}
      `,
      values,
    );

    return result.rows.map(mapDashboardRow);
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
    lessonAccessMode?: ContractsV1.CourseLessonAccessModeV1;
  }): Promise<ContractsV1.ExpertCourseV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const expert = await this.expertsRepository.findExpertById(params.expertId);
    if (!expert) {
      throw new NotFoundException({ code: ErrorCodes.EXPERT_NOT_FOUND, message: 'Expert not found' });
    }

    const lessonAccessMode = params.lessonAccessMode ?? 'sequential';
    const result = await this.pool.query<CourseRow>(
      `
      INSERT INTO courses (id, expert_id, title, description, cover_url, price_cents, currency, status, visibility, lesson_access_mode, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, NOW(), NOW())
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
        lessonAccessMode,
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

    const lessonMode =
      params.patch.lessonAccessMode === undefined ? null : params.patch.lessonAccessMode;
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
        lesson_access_mode = COALESCE($9, lesson_access_mode),
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
        lessonMode,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({ code: ErrorCodes.COURSE_NOT_FOUND, message: 'Course not found' });
    }

    if (params.patch.authorDisplayName !== undefined) {
      const next = trimAuthorDisplayName(params.patch.authorDisplayName ?? null);
      try {
        await this.pool.query(
          `UPDATE courses SET author_display_name = $3, updated_at = NOW() WHERE id = $1 AND expert_id = $2`,
          [params.courseId, params.expertId, next],
        );
        return this.getById({ expertId: params.expertId, courseId: params.courseId });
      } catch (e: unknown) {
        const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined;
        if (code === '42703') {
          return mapRow(row);
        }
        throw e;
      }
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

