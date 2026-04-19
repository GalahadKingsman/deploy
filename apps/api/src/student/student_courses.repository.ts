import { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents?: number | null;
  currency?: string | null;
  updated_at: Date;
  status: string;
  visibility: string;
}

interface LessonRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
  content_md: string | null;
  updated_at: Date;
  video: unknown | null;
}

export class StudentCoursesRepository {
  constructor(private readonly pool: Pool | null) {}

  async listLibrary(): Promise<{ courses: ContractsV1.CourseV1[]; recommended: ContractsV1.CourseV1[] }> {
    if (!this.pool) return { courses: [], recommended: [] };
    const res = await this.pool.query<CourseRow>(
      `
      SELECT id, title, description, cover_url, price_cents, currency, updated_at, status, visibility
      FROM courses
      WHERE deleted_at IS NULL AND status = 'published' AND visibility = 'public'
      ORDER BY updated_at DESC
      LIMIT 200
      `,
    );
    const courses = res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      coverUrl: r.cover_url ?? null,
      authorName: null,
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
    const res = await this.pool.query<CourseRow>(
      `
      SELECT id, title, description, cover_url, price_cents, currency, updated_at, status, visibility
      FROM courses
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [courseId],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      coverUrl: r.cover_url ?? null,
      authorName: null,
      priceCents: r.price_cents ?? 0,
      currency: r.currency ?? 'RUB',
      updatedAt: r.updated_at.toISOString(),
      status: r.status as any,
      visibility: r.visibility as any,
    };
  }

  async listLessonsByCourseId(courseId: string): Promise<ContractsV1.LessonV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<LessonRow>(
      `
      SELECT l.id, m.course_id, l.title, l.position, l.content_md, l.updated_at, l.video
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id
      WHERE m.course_id = $1 AND l.deleted_at IS NULL AND m.deleted_at IS NULL
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
      updatedAt: r.updated_at.toISOString(),
      video: (r.video as any) ?? undefined,
    }));
  }

  async listLessonsByModuleId(params: { courseId: string; moduleId: string }): Promise<ContractsV1.LessonV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<LessonRow>(
      `
      SELECT l.id, m.course_id, l.title, l.position, l.content_md, l.updated_at, l.video
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id
      WHERE m.course_id = $1 AND m.id = $2 AND l.deleted_at IS NULL AND m.deleted_at IS NULL
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
      updatedAt: r.updated_at.toISOString(),
      video: (r.video as any) ?? undefined,
    }));
  }

  async getLesson(lessonId: string): Promise<ContractsV1.LessonV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<LessonRow>(
      `
      SELECT l.id, m.course_id, l.title, l.position, l.content_md, l.updated_at, l.video
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id
      WHERE l.id = $1 AND l.deleted_at IS NULL AND m.deleted_at IS NULL
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
      SELECT l.id, m.course_id, l.title, l.position, l.content_md, l.updated_at, l.video,
             c.title AS course_title, m.title AS module_title
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
      JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
      WHERE l.id = $1 AND l.deleted_at IS NULL
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
        updatedAt: r.updated_at.toISOString(),
        video: (r.video as any) ?? undefined,
      },
      courseTitle: r.course_title,
      moduleTitle: r.module_title,
    };
  }
}

