import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ContractsV1 } from '@tracked/shared';

interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_user_id: string;
  created_at: Date;
  text: string | null;
  link: string | null;
  file_key: string | null;
  status: string;
  score: number | null;
  reviewer_comment: string | null;
}

function mapRow(
  r: SubmissionRow,
  lessonId: string,
  studentTelegramUsername?: string | null,
): ContractsV1.SubmissionV1 {
  const base: ContractsV1.SubmissionV1 = {
    id: r.id,
    assignmentId: r.assignment_id,
    lessonId,
    studentId: r.student_user_id,
    createdAt: r.created_at.toISOString(),
    text: r.text ?? null,
    link: r.link ?? null,
    fileKey: r.file_key ?? null,
    status: r.status as ContractsV1.SubmissionStatusV1,
    score: typeof r.score === 'number' ? r.score : null,
    reviewerComment: r.reviewer_comment ?? null,
  };
  if (studentTelegramUsername !== undefined) {
    base.studentTelegramUsername = studentTelegramUsername ?? null;
  }
  return base;
}

export class SubmissionsRepository {
  constructor(private readonly pool: Pool | null) {}

  async getStudentHomeworkAvgScore(studentUserId: string): Promise<{ avgScore: number | null; gradedCount: number }> {
    if (!this.pool) return { avgScore: null, gradedCount: 0 };
    const res = await this.pool.query<{ avg: number | null; cnt: string }>(
      `
      SELECT AVG(score)::float AS avg, COUNT(score)::text AS cnt
      FROM submissions
      WHERE student_user_id = $1 AND score IS NOT NULL
      `,
      [studentUserId],
    );
    const row = res.rows[0];
    const avg = typeof row?.avg === 'number' && Number.isFinite(row.avg) ? row.avg : null;
    const cnt = Math.max(0, parseInt(row?.cnt ?? '0', 10) || 0);
    // Clamp to expected domain (score check constraint is 1..5, but be defensive)
    const clamped = avg == null ? null : Math.max(1, Math.min(5, avg));
    return { avgScore: clamped, gradedCount: cnt };
  }

  async listExpertHomeworkInbox(params: {
    expertId: string;
    reviewerUserId: string;
    filter: 'all' | 'new' | 'checked' | 'unchecked';
    limit: number;
  }): Promise<
    Array<{
      submissionId: string;
      lessonId: string;
      assignmentId: string;
      studentId: string;
      createdAt: string;
      studentFirstName: string | null;
      studentLastName: string | null;
      studentUsername: string | null;
      studentEmail: string | null;
      studentAvatarUrl: string | null;
      courseTitle: string;
      moduleTitle: string;
      lessonTitle: string;
      answerPreview: string;
      submissionStatus: ContractsV1.SubmissionStatusV1;
      isOpened: boolean;
      uiStatus: 'new' | 'unchecked' | 'checked';
    }>
  > {
    if (!this.pool) return [];
    const lim = Math.min(500, Math.max(1, Number.isFinite(params.limit) ? Math.floor(params.limit) : 200));
    const filter = params.filter;

    const res = await this.pool.query<{
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
      ORDER BY latest.created_at DESC
      LIMIT $2
      `,
      [params.expertId, lim],
    );

    const mapped = res.rows.map((r) => {
      const answer = (r.text ?? '').trim();
      const preview = answer.length > 180 ? `${answer.slice(0, 180).trim()}…` : answer;
      const isOpened = r.opened_at != null;
      const isChecked = r.status === 'accepted';
      const uiStatus: 'new' | 'unchecked' | 'checked' = isChecked ? 'checked' : isOpened ? 'unchecked' : 'new';
      return {
        submissionId: r.submission_id,
        assignmentId: r.assignment_id,
        lessonId: r.lesson_id,
        studentId: r.student_user_id,
        createdAt: r.created_at.toISOString(),
        studentFirstName: r.student_first_name,
        studentLastName: r.student_last_name,
        studentUsername: r.student_username,
        studentEmail: r.student_email,
        studentAvatarUrl: r.student_avatar_url,
        courseTitle: r.course_title,
        moduleTitle: r.module_title,
        lessonTitle: r.lesson_title,
        answerPreview: preview,
        submissionStatus: r.status as ContractsV1.SubmissionStatusV1,
        isOpened,
        uiStatus,
      };
    });

    if (filter === 'all') return mapped;
    if (filter === 'new') return mapped.filter((x) => x.uiStatus === 'new');
    if (filter === 'checked') return mapped.filter((x) => x.uiStatus === 'checked');
    return mapped.filter((x) => x.uiStatus === 'unchecked');
  }

  async getExpertHomeworkDetailAndMarkOpened(params: {
    expertId: string;
    reviewerUserId: string;
    submissionId: string;
  }): Promise<{
    submission: ContractsV1.SubmissionV1;
    courseTitle: string;
    moduleTitle: string;
    lessonTitle: string;
    student: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      email: string | null;
      avatarUrl: string | null;
    };
  } | null> {
    if (!this.pool) return null;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<{
        id: string;
        assignment_id: string;
        student_user_id: string;
        created_at: Date;
        text: string | null;
        link: string | null;
        file_key: string | null;
        status: string;
        score: number | null;
        reviewer_comment: string | null;
        lesson_id: string;
        course_title: string;
        module_title: string;
        lesson_title: string;
        student_first_name: string | null;
        student_last_name: string | null;
        student_username: string | null;
        student_email: string | null;
        student_avatar_url: string | null;
      }>(
        `
        SELECT
          s.id,
          s.assignment_id,
          s.student_user_id,
          s.created_at,
          s.text,
          s.link,
          s.file_key,
          s.status,
          s.score,
          s.reviewer_comment,
          a.lesson_id,
          c.title AS course_title,
          m.title AS module_title,
          l.title AS lesson_title,
          u.first_name AS student_first_name,
          u.last_name AS student_last_name,
          u.username AS student_username,
          u.email AS student_email,
          u.avatar_url AS student_avatar_url
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
        JOIN users u ON u.id = s.student_user_id
        WHERE s.id = $1 AND c.expert_id = $2
        LIMIT 1
        `,
        [params.submissionId, params.expertId],
      );
      const row = res.rows[0] ?? null;
      if (!row) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `
        INSERT INTO expert_submission_views (submission_id, opened_by_user_id)
        VALUES ($1, $2)
        ON CONFLICT (submission_id) DO UPDATE
          SET last_opened_at = now(), opened_by_user_id = EXCLUDED.opened_by_user_id
        `,
        [row.id, params.reviewerUserId],
      );

      await client.query('COMMIT');

      return {
        submission: mapRow(
          {
            id: row.id,
            assignment_id: row.assignment_id,
            student_user_id: row.student_user_id,
            created_at: row.created_at,
            text: row.text,
            link: row.link,
            file_key: row.file_key,
            status: row.status,
            score: row.score,
            reviewer_comment: row.reviewer_comment,
          },
          row.lesson_id,
          row.student_username,
        ),
        courseTitle: row.course_title,
        moduleTitle: row.module_title,
        lessonTitle: row.lesson_title,
        student: {
          id: row.student_user_id,
          firstName: row.student_first_name,
          lastName: row.student_last_name,
          username: row.student_username,
          email: row.student_email,
          avatarUrl: row.student_avatar_url,
        },
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async listMyByLesson(params: { userId: string; lessonId: string }): Promise<ContractsV1.SubmissionV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<{
      id: string;
      assignment_id: string;
      student_user_id: string;
      created_at: Date;
      text: string | null;
      link: string | null;
      file_key: string | null;
      status: string;
      score: number | null;
      reviewer_comment: string | null;
      lesson_id: string;
      student_telegram_username: string | null;
    }>(
      `
      SELECT s.id, s.assignment_id, s.student_user_id, s.created_at, s.text, s.link, s.file_key, s.status,
             s.score, s.reviewer_comment,
             a.lesson_id,
             u.username AS student_telegram_username
      FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      JOIN users u ON u.id = s.student_user_id
      WHERE s.student_user_id = $1 AND a.lesson_id = $2
      ORDER BY s.created_at DESC
      LIMIT 50
      `,
      [params.userId, params.lessonId],
    );
    return res.rows.map((r) =>
      mapRow(
        {
          id: r.id,
          assignment_id: r.assignment_id,
          student_user_id: r.student_user_id,
          created_at: r.created_at,
          text: r.text,
          link: r.link,
          file_key: r.file_key,
          status: r.status,
          score: r.score,
          reviewer_comment: r.reviewer_comment,
        },
        r.lesson_id,
        r.student_telegram_username,
      ),
    );
  }

  /**
   * Latest homework per lesson (resubmits are new rows — we only keep the newest per lesson_id),
   * then the N most recently touched lessons. Only courses with active enrollment.
   */
  async listMyRecentEnriched(params: { userId: string; limit: number }): Promise<ContractsV1.MyRecentSubmissionItemV1[]> {
    if (!this.pool) return [];
    const lim = Math.min(50, Math.max(1, Number.isFinite(params.limit) ? Math.floor(params.limit) : 3));
    const res = await this.pool.query<{
      id: string;
      assignment_id: string;
      student_user_id: string;
      created_at: Date;
      text: string | null;
      link: string | null;
      file_key: string | null;
      status: string;
      score: number | null;
      reviewer_comment: string | null;
      lesson_id: string;
      student_telegram_username: string | null;
      course_title: string;
      module_title: string;
      lesson_title: string;
    }>(
      `
      SELECT sub.id, sub.assignment_id, sub.student_user_id, sub.created_at, sub.text, sub.link, sub.file_key,
             sub.status, sub.score, sub.reviewer_comment,
             sub.lesson_id,
             sub.student_telegram_username,
             sub.course_title, sub.module_title, sub.lesson_title
      FROM (
        SELECT DISTINCT ON (a.lesson_id)
          s.id, s.assignment_id, s.student_user_id, s.created_at, s.text, s.link, s.file_key, s.status,
          s.score, s.reviewer_comment,
          a.lesson_id,
          u.username AS student_telegram_username,
          c.title AS course_title,
          m.title AS module_title,
          l.title AS lesson_title
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
        JOIN users u ON u.id = s.student_user_id
        INNER JOIN enrollments e
          ON e.user_id = s.student_user_id
         AND e.course_id = c.id
         AND e.revoked_at IS NULL
         AND (e.access_end IS NULL OR e.access_end > NOW())
        WHERE s.student_user_id = $1
        ORDER BY a.lesson_id, s.created_at DESC
      ) sub
      ORDER BY sub.created_at DESC
      LIMIT $2
      `,
      [params.userId, lim],
    );
    return res.rows.map((r) => {
      const base = mapRow(
        {
          id: r.id,
          assignment_id: r.assignment_id,
          student_user_id: r.student_user_id,
          created_at: r.created_at,
          text: r.text,
          link: r.link,
          file_key: r.file_key,
          status: r.status,
          score: r.score,
          reviewer_comment: r.reviewer_comment,
        },
        r.lesson_id,
        r.student_telegram_username,
      );
      return {
        ...base,
        courseTitle: r.course_title,
        moduleTitle: r.module_title,
        lessonTitle: r.lesson_title,
      };
    });
  }

  async findForDownload(submissionId: string): Promise<{
    submissionId: string;
    lessonId: string;
    studentUserId: string;
    fileKey: string | null;
  } | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<{
      id: string;
      student_user_id: string;
      file_key: string | null;
      lesson_id: string;
    }>(
      `
      SELECT s.id, s.student_user_id, s.file_key, a.lesson_id
      FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      WHERE s.id = $1
      LIMIT 1
      `,
      [submissionId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      submissionId: row.id,
      lessonId: row.lesson_id,
      studentUserId: row.student_user_id,
      fileKey: row.file_key ?? null,
    };
  }

  async create(params: {
    assignmentId: string;
    lessonId: string;
    studentUserId: string;
    text: string | null;
    link: string | null;
    fileKey: string | null;
  }): Promise<ContractsV1.SubmissionV1> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const res = await this.pool.query<SubmissionRow>(
      `
      INSERT INTO submissions (id, assignment_id, student_user_id, created_at, text, link, file_key, status)
      VALUES ($1, $2, $3, NOW(), $4, $5, $6, 'submitted')
      RETURNING *
      `,
      [randomUUID(), params.assignmentId, params.studentUserId, params.text, params.link, params.fileKey],
    );
    return mapRow(res.rows[0], params.lessonId);
  }

  async listByAssignmentId(params: { assignmentId: string; lessonId: string }): Promise<ContractsV1.SubmissionV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<
      SubmissionRow & { student_telegram_username: string | null }
    >(
      `
      SELECT s.id, s.assignment_id, s.student_user_id, s.created_at, s.text, s.link, s.file_key, s.status,
             s.score, s.reviewer_comment,
             u.username AS student_telegram_username
      FROM submissions s
      JOIN users u ON u.id = s.student_user_id
      WHERE s.assignment_id = $1
      ORDER BY s.created_at DESC
      LIMIT 200
      `,
      [params.assignmentId],
    );
    return res.rows.map((r) =>
      mapRow(
        {
          id: r.id,
          assignment_id: r.assignment_id,
          student_user_id: r.student_user_id,
          created_at: r.created_at,
          text: r.text,
          link: r.link,
          file_key: r.file_key,
          status: r.status,
          score: r.score,
          reviewer_comment: r.reviewer_comment,
        },
        params.lessonId,
        r.student_telegram_username,
      ),
    );
  }

  async decide(params: {
    submissionId: string;
    status: ContractsV1.SubmissionStatusV1;
    decidedByUserId: string | null;
    lessonId: string;
    score?: number | null;
    scoreProvided?: boolean;
    reviewerComment?: string | null;
    reviewerCommentProvided?: boolean;
  }): Promise<ContractsV1.SubmissionV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<SubmissionRow>(
      `
      UPDATE submissions
      SET status = $2,
          decided_at = NOW(),
          decided_by_user_id = $3,
          score = CASE WHEN $4 THEN $5 ELSE score END,
          reviewer_comment = CASE WHEN $6 THEN $7 ELSE reviewer_comment END
      WHERE id = $1
      RETURNING *
      `,
      [
        params.submissionId,
        params.status,
        params.decidedByUserId,
        Boolean(params.scoreProvided),
        params.score ?? null,
        Boolean(params.reviewerCommentProvided),
        params.reviewerComment ?? null,
      ],
    );
    const row = res.rows[0];
    return row ? mapRow(row, params.lessonId) : null;
  }
}

