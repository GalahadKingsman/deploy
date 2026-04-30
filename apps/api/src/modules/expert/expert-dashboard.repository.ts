import { Inject, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';
import { CommissionsRepository } from '../../payments/commissions.repository.js';

function initialsSql(alias: string): string {
  return `UPPER(
    SUBSTRING(COALESCE(NULLIF(TRIM(${alias}.first_name), ''), ' ') FROM 1 FOR 1) ||
    SUBSTRING(COALESCE(NULLIF(TRIM(${alias}.last_name), ''), ' ') FROM 1 FOR 1)
  )`;
}

function displayNameSql(alias: string): string {
  return `COALESCE(
    NULLIF(TRIM(COALESCE(${alias}.first_name, '') || ' ' || COALESCE(${alias}.last_name, '')), ''),
    CASE WHEN ${alias}.username IS NOT NULL AND TRIM(${alias}.username) <> '' THEN '@' || ${alias}.username ELSE NULL END,
    'Студент'
  )`;
}

/** node-pg may return timestamptz as Date or string depending on config. */
function rowTimestampToIso(v: Date | string | null | undefined): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : new Date(0).toISOString();
  }
  return new Date(0).toISOString();
}

export class ExpertDashboardRepository {
  constructor(
    @Optional() @Inject(Pool) private readonly pool: Pool | null,
    private readonly commissionsRepository: CommissionsRepository,
  ) {}

  async getDashboard(params: {
    expertId: string;
    /** UTC calendar month. */
    year: number;
    month: number;
    restrictToCourseIds?: string[];
    referralCode: string;
    isCurrentUtcMonth: boolean;
    /** Max activity items to return. Default 30, max 200. */
    activityLimit?: number;
  }): Promise<ContractsV1.ExpertDashboardResponseV1> {
    const empty = (): ContractsV1.ExpertDashboardResponseV1 => {
      const start = new Date(Date.UTC(params.year, params.month - 1, 1, 0, 0, 0, 0));
      const endExclusive = new Date(Date.UTC(params.year, params.month, 1, 0, 0, 0, 0));
      return {
        period: {
          year: params.year,
          month: params.month,
          startIso: start.toISOString(),
          endExclusiveIso: endExclusive.toISOString(),
        },
        students: { totalUnique: 0, newEnrollmentsInMonth: 0 },
        courses: { publishedCount: 0, draftCount: 0 },
        referral: { totalRubInMonth: 0, deltaRubVsPreviousMonth: 0 },
        homework: { pendingInMonth: 0, newTodayUtc: 0, previewItems: [] },
        activity: { items: [] },
      };
    };

    if (!this.pool) return empty();

    const start = new Date(Date.UTC(params.year, params.month - 1, 1, 0, 0, 0, 0));
    const endExclusive = new Date(Date.UTC(params.year, params.month, 1, 0, 0, 0, 0));
    const prevStart = new Date(Date.UTC(params.year, params.month - 2, 1, 0, 0, 0, 0));
    const prevEndExclusive = start;

    const restrict = params.restrictToCourseIds;
    const hasRestrict = restrict !== undefined && restrict.length > 0;
    // IMPORTANT: do not use $4 without $2/$3 in Postgres — it forces typing for missing params.
    // Keep query args aligned to the actually referenced parameter numbers.
    const dateWindowCourseFilter = hasRestrict ? 'AND c.id = ANY($4::uuid[])' : '';
    const baseArgs: unknown[] = [params.expertId, start, endExclusive];
    if (hasRestrict) baseArgs.push(restrict);

    const courseFilter2 = hasRestrict ? 'AND c.id = ANY($2::uuid[])' : '';
    const argsExpertOnly: unknown[] = hasRestrict ? [params.expertId, restrict] : [params.expertId];

    const totalUniqueRes = await this.pool.query<{ c: string }>(
      `
      SELECT COUNT(DISTINCT e.user_id)::text AS c
      FROM enrollments e
      INNER JOIN courses c ON c.id = e.course_id AND c.deleted_at IS NULL
      WHERE c.expert_id = $1
        AND e.revoked_at IS NULL
        AND (e.access_end IS NULL OR e.access_end > NOW())
        ${courseFilter2}
      `,
      argsExpertOnly,
    );
    const totalUnique = Math.max(0, parseInt(totalUniqueRes.rows[0]?.c ?? '0', 10) || 0);

    const newEnrRes = await this.pool.query<{ c: string }>(
      `
      SELECT COUNT(*)::text AS c
      FROM enrollments e
      INNER JOIN courses c ON c.id = e.course_id AND c.deleted_at IS NULL
      WHERE c.expert_id = $1
        AND e.revoked_at IS NULL
        AND (e.access_end IS NULL OR e.access_end > NOW())
        AND e.created_at >= $2 AND e.created_at < $3
        ${dateWindowCourseFilter}
      `,
      baseArgs,
    );
    const newEnrollmentsInMonth = Math.max(0, parseInt(newEnrRes.rows[0]?.c ?? '0', 10) || 0);

    const courseCountsRes = await this.pool.query<{ pub: string; dr: string }>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN c.status = 'published' THEN 1 ELSE 0 END), 0)::text AS pub,
        COALESCE(SUM(CASE WHEN c.status = 'draft' THEN 1 ELSE 0 END), 0)::text AS dr
      FROM courses c
      WHERE c.expert_id = $1 AND c.deleted_at IS NULL
        ${hasRestrict ? 'AND c.id = ANY($2::uuid[])' : ''}
      `,
      hasRestrict ? [params.expertId, restrict] : [params.expertId],
    );
    const publishedCount = Math.max(0, parseInt(courseCountsRes.rows[0]?.pub ?? '0', 10) || 0);
    const draftCount = Math.max(0, parseInt(courseCountsRes.rows[0]?.dr ?? '0', 10) || 0);

    const curCents = await this.commissionsRepository.sumAmountCentsByReferralCodeBetween({
      referralCode: params.referralCode,
      startInclusive: start,
      endExclusive,
    });
    const prevCents = await this.commissionsRepository.sumAmountCentsByReferralCodeBetween({
      referralCode: params.referralCode,
      startInclusive: prevStart,
      endExclusive: prevEndExclusive,
    });
    const totalRubInMonth = Math.round(curCents / 100);
    const deltaRubVsPreviousMonth = Math.round(curCents / 100) - Math.round(prevCents / 100);

    const restrictClause = hasRestrict ? 'AND c.id = ANY($4::uuid[])' : '';
    const hwArgs = [...baseArgs];
    const pendingRes = await this.pool.query<{ c: string }>(
      `
      WITH latest AS (
        SELECT DISTINCT ON (s.student_user_id, a.lesson_id)
          s.id AS submission_id,
          s.created_at,
          s.status
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
        WHERE c.expert_id = $1
          ${restrictClause}
        ORDER BY s.student_user_id, a.lesson_id, s.created_at DESC
      )
      SELECT COUNT(*)::text AS c
      FROM latest
      WHERE latest.status IS DISTINCT FROM 'accepted'
        AND latest.created_at >= $2 AND latest.created_at < $3
      `,
      hwArgs,
    );
    const pendingInMonth = Math.max(0, parseInt(pendingRes.rows[0]?.c ?? '0', 10) || 0);

    let newTodayUtc = 0;
    if (params.isCurrentUtcMonth) {
      const todayRes = await this.pool.query<{ c: string }>(
        `
        WITH latest AS (
          SELECT DISTINCT ON (s.student_user_id, a.lesson_id)
            s.id AS submission_id,
            s.created_at,
            s.status
          FROM submissions s
          JOIN assignments a ON a.id = s.assignment_id
          JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
          JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
          JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
          WHERE c.expert_id = $1
            ${restrictClause}
          ORDER BY s.student_user_id, a.lesson_id, s.created_at DESC
        )
        SELECT COUNT(*)::text AS c
        FROM latest
        LEFT JOIN expert_submission_views v ON v.submission_id = latest.submission_id
        WHERE latest.status IS DISTINCT FROM 'accepted'
          AND v.submission_id IS NULL
          AND latest.created_at >= $2 AND latest.created_at < $3
          AND (latest.created_at::date = (timezone('UTC', now()))::date)
        `,
        hwArgs,
      );
      newTodayUtc = Math.max(0, parseInt(todayRes.rows[0]?.c ?? '0', 10) || 0);
    }

    const previewRes = await this.pool.query<{
      submission_id: string;
      assignment_id: string;
      lesson_id: string;
      student_user_id: string;
      created_at: Date;
      text: string | null;
      status: string;
      opened_at: Date | null;
      student_first_name: string | null;
      student_last_name: string | null;
      student_username: string | null;
      student_email: string | null;
      student_avatar_url: string | null;
      course_title: string;
      module_title: string;
      lesson_title: string;
    }>(
      `
      WITH latest AS (
        SELECT DISTINCT ON (s.student_user_id, a.lesson_id)
          s.id AS submission_id,
          s.assignment_id,
          a.lesson_id,
          s.student_user_id,
          s.created_at,
          s.text,
          s.status
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
        WHERE c.expert_id = $1
          ${restrictClause}
        ORDER BY s.student_user_id, a.lesson_id, s.created_at DESC
      )
      SELECT
        latest.submission_id,
        latest.assignment_id,
        latest.lesson_id,
        latest.student_user_id,
        latest.created_at,
        latest.text,
        latest.status,
        v.last_opened_at AS opened_at,
        u.first_name AS student_first_name,
        u.last_name AS student_last_name,
        u.username AS student_username,
        u.email AS student_email,
        u.avatar_url AS student_avatar_url,
        c.title AS course_title,
        m.title AS module_title,
        l.title AS lesson_title
      FROM latest
      JOIN lessons l ON l.id = latest.lesson_id
      JOIN course_modules m ON m.id = l.module_id
      JOIN courses c ON c.id = m.course_id
      JOIN users u ON u.id = latest.student_user_id
      LEFT JOIN expert_submission_views v ON v.submission_id = latest.submission_id
      WHERE latest.created_at >= $2 AND latest.created_at < $3
      ORDER BY latest.created_at DESC
      LIMIT 2
      `,
      hwArgs,
    );

    const previewItems: ContractsV1.ExpertDashboardHomeworkPreviewItemV1[] = previewRes.rows.map((r) => {
      const answer = (r.text ?? '').trim();
      const preview = answer.length > 180 ? `${answer.slice(0, 180).trim()}…` : answer;
      const isOpened = r.opened_at != null;
      const isChecked = r.status === 'accepted';
      const uiStatus: 'new' | 'unchecked' | 'checked' = isChecked ? 'checked' : isOpened ? 'unchecked' : 'new';
      return {
        submissionId: r.submission_id,
        lessonId: r.lesson_id,
        assignmentId: r.assignment_id,
        studentId: r.student_user_id,
        createdAt: rowTimestampToIso(r.created_at),
        studentFirstName: r.student_first_name,
        studentLastName: r.student_last_name,
        studentUsername: r.student_username,
        studentEmail: r.student_email,
        studentAvatarUrl: r.student_avatar_url,
        courseTitle: r.course_title,
        moduleTitle: r.module_title,
        lessonTitle: r.lesson_title,
        answerPreview: preview,
        submissionStatus: r.status,
        isOpened,
        uiStatus,
      };
    });

    const ini = initialsSql('u');
    const dn = displayNameSql('u');

    const actLimitRaw = Math.floor(Number(params.activityLimit ?? 30));
    const actLimit = Math.max(1, Math.min(200, Number.isFinite(actLimitRaw) ? actLimitRaw : 30));

    const activitySql = `
      SELECT * FROM (
        SELECT
          'homework_submitted'::text AS kind,
          s.created_at AS occurred_at,
          ${dn} AS actor_display,
          ${ini} AS actor_initials,
          ('Сдано ДЗ: «' || COALESCE(l.title, '') || '»')::text AS description,
          'ДЗ'::text AS badge_text,
          'new'::text AS badge_variant
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
        JOIN users u ON u.id = s.student_user_id
        WHERE c.expert_id = $1
          AND s.created_at >= $2 AND s.created_at < $3
          ${hasRestrict ? 'AND c.id = ANY($4::uuid[])' : ''}

        UNION ALL

        SELECT
          'enrollment'::text,
          e.created_at,
          ${dn},
          ${ini},
          ('Запись на курс «' || COALESCE(c.title, '') || '»')::text,
          '+1'::text,
          'live'::text
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id AND c.deleted_at IS NULL
        JOIN users u ON u.id = e.user_id
        WHERE c.expert_id = $1
          AND e.revoked_at IS NULL
          AND e.created_at >= $2 AND e.created_at < $3
          ${hasRestrict ? 'AND c.id = ANY($4::uuid[])' : ''}

        UNION ALL

        SELECT
          'lesson_completed'::text,
          lp.completed_at,
          ${dn},
          ${ini},
          ('Урок завершён: «' || COALESCE(l.title, '') || '»')::text,
          COALESCE(NULLIF(TRIM(SUBSTRING(l.title FROM 1 FOR 18)), ''), 'Урок')::text,
          'muted'::text
        FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id AND l.deleted_at IS NULL
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
        JOIN users u ON u.id = lp.user_id
        WHERE c.expert_id = $1
          AND lp.completed_at >= $2 AND lp.completed_at < $3
          ${hasRestrict ? 'AND c.id = ANY($4::uuid[])' : ''}
      ) x
      ORDER BY x.occurred_at DESC
      LIMIT ${actLimit}
    `;

    const actRes = await this.pool.query<{
      kind: string;
      occurred_at: Date;
      actor_display: string;
      actor_initials: string;
      description: string;
      badge_text: string;
      badge_variant: string;
    }>(activitySql, baseArgs);

    const activityItems: ContractsV1.ExpertDashboardActivityItemV1[] = actRes.rows.map((r) => ({
      kind: r.kind as ContractsV1.ExpertDashboardActivityKindV1,
      occurredAt: rowTimestampToIso(r.occurred_at),
      actorDisplayName: r.actor_display,
      actorInitials: (r.actor_initials ?? '').trim() || '—',
      description: r.description,
      badgeText: r.badge_text,
      badgeVariant: r.badge_variant as 'new' | 'live' | 'draft' | 'muted',
    }));

    return {
      period: {
        year: params.year,
        month: params.month,
        startIso: start.toISOString(),
        endExclusiveIso: endExclusive.toISOString(),
      },
      students: { totalUnique, newEnrollmentsInMonth },
      courses: { publishedCount, draftCount },
      referral: { totalRubInMonth, deltaRubVsPreviousMonth },
      homework: { pendingInMonth, newTodayUtc, previewItems },
      activity: { items: activityItems },
    };
  }
}
