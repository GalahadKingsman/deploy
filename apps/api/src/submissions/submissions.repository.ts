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

function mapRow(r: SubmissionRow, lessonId: string): ContractsV1.SubmissionV1 {
  return {
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
}

export class SubmissionsRepository {
  constructor(private readonly pool: Pool | null) {}

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
    }>(
      `
      SELECT s.id, s.assignment_id, s.student_user_id, s.created_at, s.text, s.link, s.file_key, s.status,
             s.score, s.reviewer_comment,
             a.lesson_id
      FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
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
      ),
    );
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
    const res = await this.pool.query<SubmissionRow>(
      `SELECT * FROM submissions WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [params.assignmentId],
    );
    return res.rows.map((r) => mapRow(r, params.lessonId));
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

