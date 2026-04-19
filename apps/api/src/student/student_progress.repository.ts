import { Pool } from 'pg';

export class ProgressRepository {
  constructor(private readonly pool: Pool | null) {}

  async markLessonCompleted(params: { userId: string; lessonId: string }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    await this.pool.query(
      `
      INSERT INTO lesson_progress (user_id, lesson_id, completed_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, lesson_id) DO NOTHING
      `,
      [params.userId, params.lessonId],
    );
  }

  async listCompletedLessonIdsByCourse(params: { userId: string; courseId: string }): Promise<string[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<{ lesson_id: string }>(
      `
      WITH completed AS (
        -- New progress-based completion
        SELECT p.lesson_id, p.completed_at AS at
        FROM lesson_progress p
        JOIN lessons l ON l.id = p.lesson_id AND l.deleted_at IS NULL
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        WHERE p.user_id = $1 AND m.course_id = $2

        UNION ALL

        -- Backfill compatibility: accepted homework implies lesson completion
        SELECT a.lesson_id, s.decided_at AS at
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        WHERE s.student_user_id = $1 AND m.course_id = $2 AND s.status = 'accepted'
      )
      SELECT lesson_id
      FROM completed
      GROUP BY lesson_id
      ORDER BY MIN(at) ASC NULLS LAST
      `,
      [params.userId, params.courseId],
    );
    return res.rows.map((r) => r.lesson_id);
  }

  async countCompletedByCourse(params: { userId: string; courseId: string }): Promise<number> {
    if (!this.pool) return 0;
    const res = await this.pool.query<{ cnt: string }>(
      `
      SELECT COUNT(*)::text as cnt
      FROM lesson_progress p
      JOIN lessons l ON l.id = p.lesson_id AND l.deleted_at IS NULL
      JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
      WHERE p.user_id = $1 AND m.course_id = $2
      `,
      [params.userId, params.courseId],
    );
    return parseInt(res.rows[0]?.cnt ?? '0', 10);
  }

  async countLessonsInCourse(courseId: string): Promise<number> {
    if (!this.pool) return 0;
    const res = await this.pool.query<{ cnt: string }>(
      `
      SELECT COUNT(*)::text as cnt
      FROM lessons l
      JOIN course_modules m ON m.id = l.module_id
      WHERE m.course_id = $1 AND l.deleted_at IS NULL AND m.deleted_at IS NULL
      `,
      [courseId],
    );
    return parseInt(res.rows[0]?.cnt ?? '0', 10);
  }
}

