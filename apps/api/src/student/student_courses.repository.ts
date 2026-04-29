import { Pool } from 'pg';
import { ContractsV1 } from '@tracked/shared';

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  author_display_name?: string | null;
  enrollment_contact_url?: string | null;
  estimated_completion_hours?: number | null;
  price_cents?: number | null;
  currency?: string | null;
  updated_at: Date;
  status: string;
  visibility: string;
  lesson_access_mode?: string | null;
}

function mapStudentAuthorName(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  return s ? s.slice(0, 240) : null;
}

function mapStudentEnrollmentContactUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const t = s.slice(0, ContractsV1.ENROLLMENT_CONTACT_URL_MAX_LEN);
  return ContractsV1.isEnrollmentContactUrlAllowed(t) ? t : null;
}

function hoursFromDbStudent(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 8760);
}

interface LessonRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
  content_md: string | null;
  slider: unknown | null;
  presentation: unknown | null;
  updated_at: Date;
  video: unknown | null;
}

export class StudentCoursesRepository {
  /** When null, not yet probed — до применения миграций с новыми колонками `courses`. */
  private courseExtraColumns: { author: boolean; enrollment: boolean; duration: boolean } | null = null;

  constructor(private readonly pool: Pool | null) {}

  private async resolveCourseExtraColumns(): Promise<{ author: boolean; enrollment: boolean; duration: boolean }> {
    if (!this.pool) return { author: false, enrollment: false, duration: false };
    if (this.courseExtraColumns) return this.courseExtraColumns;
    try {
      const res = await this.pool.query<{ column_name: string }>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'courses'
          AND column_name IN ('author_display_name', 'enrollment_contact_url', 'estimated_completion_hours')
          AND table_schema IN ('public', current_schema()::text)
        `,
      );
      const set = new Set(res.rows.map((r) => r.column_name));
      this.courseExtraColumns = {
        author: set.has('author_display_name'),
        enrollment: set.has('enrollment_contact_url'),
        duration: set.has('estimated_completion_hours'),
      };
    } catch {
      this.courseExtraColumns = { author: false, enrollment: false, duration: false };
    }
    return this.courseExtraColumns;
  }

  async listLibrary(params?: {
    q?: string;
    /** topic slug or id */
    topic?: string;
  }): Promise<{ courses: ContractsV1.CourseV1[]; recommended: ContractsV1.CourseV1[] }> {
    if (!this.pool) return { courses: [], recommended: [] };
    const q = (params?.q ?? '').trim();
    const topic = (params?.topic ?? '').trim();
    const wantSearch = q.length > 0;
    const wantTopic = topic.length > 0;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topic);

    const where: string[] = [`c.deleted_at IS NULL`, `c.status = 'published'`, `c.visibility = 'public'`];
    const args: any[] = [];
    let i = 1;

    if (wantSearch) {
      where.push(`LOWER(c.title) LIKE LOWER($${i})`);
      args.push(`%${q}%`);
      i += 1;
    }
    if (wantTopic) {
      if (isUuid) {
        where.push(`EXISTS (SELECT 1 FROM course_topics ct WHERE ct.course_id = c.id AND ct.topic_id = $${i}::uuid)`);
        args.push(topic);
        i += 1;
      } else {
        where.push(
          `EXISTS (` +
            `SELECT 1 FROM course_topics ct JOIN topics t ON t.id = ct.topic_id ` +
            `WHERE ct.course_id = c.id AND t.slug = $${i}` +
          `)`,
        );
        args.push(topic);
        i += 1;
      }
    }
    const cols = await this.resolveCourseExtraColumns();
    const authorCol = cols.author ? 'c.author_display_name' : 'NULL::text AS author_display_name';
    const enrollCol = cols.enrollment ? 'c.enrollment_contact_url' : 'NULL::text AS enrollment_contact_url';
    const res = await this.pool.query<CourseRow>(
      `
      SELECT c.id, c.title, c.description, c.cover_url, ${authorCol}, ${enrollCol}, c.price_cents, c.currency, c.updated_at, c.status, c.visibility
      FROM courses c
      WHERE ${where.join(' AND ')}
      ORDER BY c.updated_at DESC
      LIMIT 200
      `,
      args,
    );
    const courses = res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      coverUrl: r.cover_url ?? null,
      authorName: mapStudentAuthorName(r.author_display_name ?? null),
      enrollmentContactUrl: mapStudentEnrollmentContactUrl(r.enrollment_contact_url ?? null),
      priceCents: r.price_cents ?? 0,
      currency: r.currency ?? 'RUB',
      lessonsCount: undefined,
      updatedAt: r.updated_at.toISOString(),
      status: (r.status as any) ?? 'published',
      visibility: (r.visibility as any) ?? 'public',
    })) satisfies ContractsV1.CourseV1[];

    return { courses, recommended: courses.slice(0, 2) };
  }

  async getCourse(courseId: string): Promise<ContractsV1.CourseV1 | null> {
    if (!this.pool) return null;
    const cols = await this.resolveCourseExtraColumns();
    const authorCol = cols.author ? 'author_display_name' : 'NULL::text AS author_display_name';
    const enrollCol = cols.enrollment ? 'enrollment_contact_url' : 'NULL::text AS enrollment_contact_url';
    const hoursCol = cols.duration ? 'estimated_completion_hours' : 'NULL::int AS estimated_completion_hours';
    const res = await this.pool.query<CourseRow>(
      `
      SELECT id, title, description, cover_url, ${authorCol}, ${enrollCol}, ${hoursCol}, price_cents, currency, updated_at, status, visibility, lesson_access_mode
      FROM courses
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [courseId],
    );
    const r = res.rows[0];
    if (!r) return null;
    const { modulesCount, lessonsCount } = await this.countPublishedStructure(courseId);
    return {
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      coverUrl: r.cover_url ?? null,
      authorName: mapStudentAuthorName(r.author_display_name ?? null),
      enrollmentContactUrl: mapStudentEnrollmentContactUrl(r.enrollment_contact_url ?? null),
      estimatedCompletionHours: hoursFromDbStudent(r.estimated_completion_hours ?? null),
      priceCents: r.price_cents ?? 0,
      currency: r.currency ?? 'RUB',
      modulesCount,
      lessonsCount,
      updatedAt: r.updated_at.toISOString(),
      status: r.status as any,
      visibility: r.visibility as any,
      lessonAccessMode: r.lesson_access_mode === 'open' ? 'open' : 'sequential',
    };
  }

  /** Модули и уроки, видимые студенту (как в listLessonsByCourseId: не удалённые, урок не скрыт). */
  async countPublishedStructure(courseId: string): Promise<{ modulesCount: number; lessonsCount: number }> {
    if (!this.pool) return { modulesCount: 0, lessonsCount: 0 };
    const res = await this.pool.query<{ m: string | number; l: string | number }>(
      `
      SELECT
        COALESCE((
          SELECT COUNT(*)::int
          FROM course_modules m
          WHERE m.course_id = $1 AND m.deleted_at IS NULL
        ), 0) AS m,
        COALESCE((
          SELECT COUNT(*)::int
          FROM lessons l
          INNER JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
          WHERE m.course_id = $1
            AND l.deleted_at IS NULL
            AND l.hidden_from_students = false
        ), 0) AS l
      `,
      [courseId],
    );
    const row = res.rows[0];
    const m = typeof row?.m === 'number' ? row.m : parseInt(String(row?.m ?? '0'), 10) || 0;
    const l = typeof row?.l === 'number' ? row.l : parseInt(String(row?.l ?? '0'), 10) || 0;
    return { modulesCount: m, lessonsCount: l };
  }

  async listLessonsByCourseId(courseId: string): Promise<ContractsV1.LessonV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<LessonRow>(
      `
      SELECT l.id, m.course_id, l.title, l.position, l.content_md, l.slider, l.presentation, l.updated_at, l.video
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id
      WHERE m.course_id = $1 AND l.deleted_at IS NULL AND m.deleted_at IS NULL
        AND l.hidden_from_students = false
      ORDER BY m.position ASC, l.position ASC, l.created_at ASC
      `,
      [courseId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      order: r.position,
      contentMarkdown: r.content_md ?? null,
      slider: (r.slider as any) ?? null,
      presentation: (r.presentation as any) ?? null,
      updatedAt: r.updated_at.toISOString(),
      video: (r.video as any) ?? undefined,
    }));
  }

  async listLessonsByModuleId(params: { courseId: string; moduleId: string }): Promise<ContractsV1.LessonV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<LessonRow>(
      `
      SELECT l.id, m.course_id, l.title, l.position, l.content_md, l.slider, l.presentation, l.updated_at, l.video
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id
      WHERE m.course_id = $1 AND m.id = $2 AND l.deleted_at IS NULL AND m.deleted_at IS NULL
        AND l.hidden_from_students = false
      ORDER BY l.position ASC, l.created_at ASC
      `,
      [params.courseId, params.moduleId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      order: r.position,
      contentMarkdown: r.content_md ?? null,
      slider: (r.slider as any) ?? null,
      presentation: (r.presentation as any) ?? null,
      updatedAt: r.updated_at.toISOString(),
      video: (r.video as any) ?? undefined,
    }));
  }

  async getLesson(lessonId: string): Promise<ContractsV1.LessonV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<LessonRow>(
      `
      SELECT l.id, m.course_id, l.title, l.position, l.content_md, l.slider, l.presentation, l.updated_at, l.video
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id
      WHERE l.id = $1 AND l.deleted_at IS NULL AND m.deleted_at IS NULL
        AND l.hidden_from_students = false
      LIMIT 1
      `,
      [lessonId],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      courseId: r.course_id,
      title: r.title,
      order: r.position,
      contentMarkdown: r.content_md ?? null,
      slider: (r.slider as any) ?? null,
      presentation: (r.presentation as any) ?? null,
      updatedAt: r.updated_at.toISOString(),
      video: (r.video as any) ?? undefined,
    };
  }

  async getLessonWithContext(lessonId: string): Promise<{
    lesson: ContractsV1.LessonV1;
    courseTitle: string;
    moduleTitle: string;
  } | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<
      LessonRow & {
        course_title: string;
        module_title: string;
      }
    >(
      `
      SELECT l.id, m.course_id, l.title, l.position, l.content_md, l.slider, l.presentation, l.updated_at, l.video,
             c.title AS course_title, m.title AS module_title
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
      JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
      WHERE l.id = $1 AND l.deleted_at IS NULL
        AND l.hidden_from_students = false
      LIMIT 1
      `,
      [lessonId],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      lesson: {
        id: r.id,
        courseId: r.course_id,
        title: r.title,
        order: r.position,
        contentMarkdown: r.content_md ?? null,
        slider: (r.slider as any) ?? null,
        presentation: (r.presentation as any) ?? null,
        updatedAt: r.updated_at.toISOString(),
        video: (r.video as any) ?? undefined,
      },
      courseTitle: r.course_title,
      moduleTitle: r.module_title,
    };
  }
}

