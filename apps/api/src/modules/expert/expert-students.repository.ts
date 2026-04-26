import { Inject, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';

type SqlRow = {
  enrollment_id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  streak_days: string | number | null;
  last_platform_visit_at: Date | null;
  total_lessons: string | number | null;
  done_lessons: string | number | null;
  hw_submitted: string | number | null;
  hw_avg: string | number | null;
};

export class ExpertStudentsRepository {
  constructor(@Optional() @Inject(Pool) private readonly pool: Pool | null) {}

  async listForExpert(params: {
    expertId: string;
    restrictToCourseIds?: string[];
  }): Promise<ContractsV1.ListExpertStudentsResponseV1> {
    if (!this.pool) {
      return {
        items: [],
        totalUniqueStudents: 0,
        activeLast7DaysUnique: 0,
        avgCompletionPercent: null,
        globalAvgHomeworkScore: null,
      };
    }

    const restrict = params.restrictToCourseIds;
    if (restrict !== undefined && restrict.length === 0) {
      return {
        items: [],
        totalUniqueStudents: 0,
        activeLast7DaysUnique: 0,
        avgCompletionPercent: null,
        globalAvgHomeworkScore: null,
      };
    }

    const hasRestrict = restrict !== undefined && restrict.length > 0;
    const courseCond = hasRestrict ? 'AND c.id = ANY($2::uuid[])' : '';
    const qParams: unknown[] = hasRestrict ? [params.expertId, restrict] : [params.expertId];

    const sql = `
      SELECT
        e.id AS enrollment_id,
        e.user_id,
        c.id AS course_id,
        c.title AS course_title,
        u.first_name,
        u.last_name,
        u.email,
        u.username,
        u.avatar_url,
        u.streak_days,
        u.last_platform_visit_at,
        COALESCE((
          SELECT COUNT(*)::int
          FROM lessons l
          INNER JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
          WHERE m.course_id = c.id AND l.deleted_at IS NULL
        ), 0) AS total_lessons,
        COALESCE((
          SELECT COUNT(*)::int
          FROM (
            SELECT p.lesson_id
            FROM lesson_progress p
            INNER JOIN lessons l ON l.id = p.lesson_id AND l.deleted_at IS NULL
            INNER JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
            WHERE p.user_id = e.user_id AND m.course_id = c.id
            UNION
            SELECT a.lesson_id
            FROM submissions s
            INNER JOIN assignments a ON a.id = s.assignment_id
            INNER JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
            INNER JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
            WHERE s.student_user_id = e.user_id AND m.course_id = c.id AND s.score IS NOT NULL
          ) x
        ), 0) AS done_lessons,
        COALESCE((
          SELECT COUNT(DISTINCT a.id)::int
          FROM assignments a
          INNER JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
          INNER JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
          WHERE m.course_id = c.id
            AND EXISTS (
              SELECT 1 FROM submissions s
              WHERE s.assignment_id = a.id AND s.student_user_id = e.user_id
            )
        ), 0) AS hw_submitted,
        (
          SELECT AVG(sq.score)::float
          FROM (
            SELECT DISTINCT ON (a2.id) s2.score
            FROM submissions s2
            INNER JOIN assignments a2 ON a2.id = s2.assignment_id
            INNER JOIN lessons l2 ON l2.id = a2.lesson_id AND l2.deleted_at IS NULL
            INNER JOIN course_modules m2 ON m2.id = l2.module_id AND m2.deleted_at IS NULL
            WHERE m2.course_id = c.id
              AND s2.student_user_id = e.user_id
              AND s2.score IS NOT NULL
            ORDER BY a2.id, s2.created_at DESC
          ) sq
        ) AS hw_avg
      FROM enrollments e
      INNER JOIN courses c ON c.id = e.course_id
      INNER JOIN users u ON u.id = e.user_id
      WHERE c.expert_id = $1
        AND c.deleted_at IS NULL
        AND e.revoked_at IS NULL
        AND (e.access_end IS NULL OR e.access_end > NOW())
        ${courseCond}
      ORDER BY c.title ASC, u.last_name ASC NULLS LAST, u.first_name ASC NULLS LAST, e.user_id ASC
      LIMIT 3000
    `;

    const res = await this.pool.query<SqlRow>(sql, qParams);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const items: ContractsV1.ExpertStudentRowV1[] = [];
    const uniqueUsers = new Set<string>();
    let sumPct = 0;
    let nPct = 0;
    const activeUsers = new Set<string>();

    for (const row of res.rows) {
      const total = Math.max(0, parseInt(String(row.total_lessons ?? '0'), 10) || 0);
      const done = Math.max(0, parseInt(String(row.done_lessons ?? '0'), 10) || 0);
      const progressPercent = total > 0 ? Math.min(100, Math.round((100.0 * done) / total)) : 0;

      const hwRaw = row.hw_avg;
      let homeworkAvgScore: number | null = null;
      if (hwRaw != null) {
        const h = typeof hwRaw === 'number' ? hwRaw : parseFloat(String(hwRaw));
        if (Number.isFinite(h)) {
          homeworkAvgScore = Math.max(1, Math.min(5, h));
        }
      }

      const streak = Math.max(0, Math.floor(parseFloat(String(row.streak_days ?? '0')) || 0));
      const visit = row.last_platform_visit_at
        ? row.last_platform_visit_at.toISOString()
        : null;

      const uid = row.user_id;
      uniqueUsers.add(uid);
      if (visit) {
        const t = Date.parse(visit);
        if (Number.isFinite(t) && t >= sevenDaysAgo) {
          activeUsers.add(uid);
        }
      }
      sumPct += progressPercent;
      nPct += 1;

      items.push({
        enrollmentId: row.enrollment_id,
        userId: row.user_id,
        courseId: row.course_id,
        courseTitle: (row.course_title ?? '').trim() || 'Курс',
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        username: row.username,
        avatarUrl: row.avatar_url,
        streakDays: streak,
        lastPlatformVisitAt: visit,
        doneLessons: done,
        totalLessons: total,
        progressPercent,
        homeworkSubmittedCount: Math.max(0, parseInt(String(row.hw_submitted ?? '0'), 10) || 0),
        homeworkAvgScore,
      });
    }

    const totalUniqueStudents = uniqueUsers.size;
    const activeLast7DaysUnique = activeUsers.size;
    const avgCompletionPercent = nPct > 0 ? Math.round((sumPct / nPct) * 10) / 10 : null;

    const globalQ = hasRestrict
      ? `
        SELECT AVG(x.score::float) AS a, COUNT(*)::int AS c
        FROM (
          SELECT DISTINCT ON (s.student_user_id, a.id)
            s.score
          FROM submissions s
          INNER JOIN assignments a ON a.id = s.assignment_id
          INNER JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
          INNER JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
          INNER JOIN courses c ON c.id = m.course_id
          INNER JOIN enrollments e ON e.user_id = s.student_user_id AND e.course_id = c.id
          WHERE c.expert_id = $1
            AND c.deleted_at IS NULL
            AND c.id = ANY($2::uuid[])
            AND e.revoked_at IS NULL
            AND (e.access_end IS NULL OR e.access_end > NOW())
            AND s.score IS NOT NULL
          ORDER BY s.student_user_id, a.id, s.created_at DESC
        ) x
      `
      : `
        SELECT AVG(x.score::float) AS a, COUNT(*)::int AS c
        FROM (
          SELECT DISTINCT ON (s.student_user_id, a.id)
            s.score
          FROM submissions s
          INNER JOIN assignments a ON a.id = s.assignment_id
          INNER JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
          INNER JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
          INNER JOIN courses c ON c.id = m.course_id
          INNER JOIN enrollments e ON e.user_id = s.student_user_id AND e.course_id = c.id
          WHERE c.expert_id = $1
            AND c.deleted_at IS NULL
            AND e.revoked_at IS NULL
            AND (e.access_end IS NULL OR e.access_end > NOW())
            AND s.score IS NOT NULL
          ORDER BY s.student_user_id, a.id, s.created_at DESC
        ) x
      `;
    const gRes = await this.pool.query<{ a: string | number | null; c: string | number }>(globalQ, qParams);
    const a = gRes.rows[0]?.a;
    const c = gRes.rows[0]?.c;
    const cnt = typeof c === 'string' ? parseInt(c, 10) : Math.floor(c ?? 0);
    const rawAvg = a == null ? null : typeof a === 'number' ? a : parseFloat(String(a));
    let globalAvgHomeworkScore: number | null = null;
    if (cnt > 0 && rawAvg != null && Number.isFinite(rawAvg)) {
      globalAvgHomeworkScore = Math.round(Math.max(1, Math.min(5, rawAvg)) * 10) / 10;
    }

    return {
      items,
      totalUniqueStudents,
      activeLast7DaysUnique,
      avgCompletionPercent,
      globalAvgHomeworkScore,
    };
  }
}
