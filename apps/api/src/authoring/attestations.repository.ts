import { NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { ContractsV1, ErrorCodes } from '@tracked/shared';

interface AttestationRow {
  id: string;
  course_id: string;
  module_id: string | null;
  position: number;
  deleted_at: Date | null;
  created_at: Date | string;
  updated_at: Date | string;
  display_kind: 'intermediate' | 'final';
}

interface QuestionRow {
  id: string;
  attestation_id: string;
  position: number;
  prompt: string;
}

interface OptionRow {
  id: string;
  question_id: string;
  position: number;
  label: string;
  is_correct: boolean;
}

interface AttemptRow {
  id: string;
  attestation_id: string;
  user_id: string;
  answers: Record<string, string>;
  correct_count: number;
  question_count: number;
  submitted_at: Date;
}

export interface AttestationContext {
  attestation: AttestationRow;
  courseTitle: string;
  moduleTitle: string | null;
}

function formatAttestationDisplayTitle(
  courseTitle: string,
  moduleTitle: string | null,
  displayKind: 'intermediate' | 'final',
): string {
  const isFinal = displayKind === 'final';
  if (moduleTitle) {
    return isFinal
      ? `Итоговая аттестация к модулю ${moduleTitle}`
      : `Промежуточная аттестация к модулю ${moduleTitle}`;
  }
  return isFinal
    ? `Итоговая аттестация к курсу ${courseTitle}`
    : `Промежуточная аттестация к курсу ${courseTitle}`;
}

/** node-pg может отдавать timestamptz как Date или string — без этого .toISOString() даёт 500. */
function pgTsToIso(v: Date | string | null | undefined): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : new Date(0).toISOString();
  }
  return new Date(0).toISOString();
}

function rowToExpertAttestation(
  attestation: AttestationRow,
  questions: QuestionRow[],
  optionsByQuestion: Map<string, OptionRow[]>,
  displayTitle: string,
): ContractsV1.ExpertAttestationV1 {
  const orderedQs = [...questions].sort((a, b) => a.position - b.position);
  return {
    id: attestation.id,
    courseId: attestation.course_id,
    moduleId: attestation.module_id,
    scope: attestation.module_id ? 'module' : 'course',
    position: Number(attestation.position),
    displayKind: attestation.display_kind,
    displayTitle,
    questions: orderedQs.map((q) => {
      const opts = (optionsByQuestion.get(q.id) ?? []).slice().sort((a, b) => a.position - b.position);
      return {
        id: q.id,
        position: q.position,
        prompt: q.prompt,
        options: opts.map((o) => ({
          id: o.id,
          position: o.position,
          label: o.label,
          isCorrect: Boolean(o.is_correct),
        })),
      };
    }),
    createdAt: pgTsToIso(attestation.created_at as Date | string),
    updatedAt: pgTsToIso(attestation.updated_at as Date | string),
  };
}

function summariseAttempt(row: AttemptRow): ContractsV1.AttestationAttemptSummaryV1 {
  const total = Math.max(1, row.question_count || 1);
  const percent = Math.round(((row.correct_count || 0) / total) * 100);
  return {
    attemptId: row.id,
    correctCount: row.correct_count,
    questionCount: row.question_count,
    percent,
    submittedAt: pgTsToIso(row.submitted_at as Date | string),
  };
}

export class AttestationsRepository {
  constructor(private readonly pool: Pool | null) {}

  private requirePool(): Pool {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    return this.pool;
  }

  /** Throws NotFound if attestation does not exist or is deleted; loads course/module titles. */
  async getContext(attestationId: string): Promise<AttestationContext> {
    const pool = this.requirePool();
    const res = await pool.query<{
      a_id: string;
      a_course_id: string;
      a_module_id: string | null;
      a_position: number;
      a_deleted_at: Date | null;
      a_created_at: Date;
      a_updated_at: Date;
      a_display_kind: string;
      course_title: string;
      module_title: string | null;
    }>(
      `
      SELECT
        a.id             AS a_id,
        a.course_id      AS a_course_id,
        a.module_id      AS a_module_id,
        a.position       AS a_position,
        a.deleted_at     AS a_deleted_at,
        a.created_at     AS a_created_at,
        a.updated_at     AS a_updated_at,
        a.display_kind   AS a_display_kind,
        c.title          AS course_title,
        m.title          AS module_title
      FROM course_attestations a
      JOIN courses c ON c.id = a.course_id AND c.deleted_at IS NULL
      LEFT JOIN course_modules m ON m.id = a.module_id AND m.deleted_at IS NULL
      WHERE a.id = $1 AND a.deleted_at IS NULL
      LIMIT 1
      `,
      [attestationId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: ErrorCodes.ATTESTATION_NOT_FOUND,
        message: 'Attestation not found',
      });
    }
    const displayKind: 'intermediate' | 'final' =
      row.a_display_kind === 'final' ? 'final' : 'intermediate';
    return {
      attestation: {
        id: row.a_id,
        course_id: row.a_course_id,
        module_id: row.a_module_id,
        position: row.a_position,
        deleted_at: row.a_deleted_at,
        created_at: row.a_created_at,
        updated_at: row.a_updated_at,
        display_kind: displayKind,
      },
      courseTitle: row.course_title,
      moduleTitle: row.module_title,
    };
  }

  /** Resolves which expert owns the course this attestation belongs to. */
  async assertBelongsToExpert(params: { expertId: string; attestationId: string }): Promise<{ courseId: string; moduleId: string | null }> {
    const pool = this.requirePool();
    const res = await pool.query<{ course_id: string; module_id: string | null }>(
      `
      SELECT a.course_id, a.module_id
      FROM course_attestations a
      JOIN courses c ON c.id = a.course_id AND c.deleted_at IS NULL
      WHERE a.id = $1
        AND a.deleted_at IS NULL
        AND c.expert_id = $2
      LIMIT 1
      `,
      [params.attestationId, params.expertId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: ErrorCodes.ATTESTATION_NOT_FOUND,
        message: 'Attestation not found',
      });
    }
    return { courseId: row.course_id, moduleId: row.module_id };
  }

  async assertCourseExists(courseId: string): Promise<{ title: string }> {
    const pool = this.requirePool();
    const res = await pool.query<{ title: string }>(
      `SELECT title FROM courses WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [courseId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException({ code: ErrorCodes.COURSE_NOT_FOUND, message: 'Course not found' });
    }
    return { title: row.title };
  }

  async assertModuleInCourse(params: {
    courseId: string;
    moduleId: string;
  }): Promise<{ title: string }> {
    const pool = this.requirePool();
    const res = await pool.query<{ title: string }>(
      `SELECT title FROM course_modules WHERE id = $1 AND course_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [params.moduleId, params.courseId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: ErrorCodes.COURSE_MODULE_NOT_FOUND,
        message: 'Course module not found',
      });
    }
    return { title: row.title };
  }

  /** Lists attestations of a course (both module-scoped and course-level), ordered by module then position. */
  async listByCourseId(courseId: string): Promise<ContractsV1.ExpertAttestationV1[]> {
    const pool = this.requirePool();
    const courseRes = await pool.query<{ title: string }>(
      `SELECT title FROM courses WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [courseId],
    );
    const courseTitle = courseRes.rows[0]?.title ?? '';
    const aRes = await pool.query<AttestationRow & { module_title: string | null }>(
      `
      SELECT a.*, m.title AS module_title
      FROM course_attestations a
      LEFT JOIN course_modules m ON m.id = a.module_id AND m.deleted_at IS NULL
      WHERE a.course_id = $1 AND a.deleted_at IS NULL
      ORDER BY (CASE WHEN a.module_id IS NULL THEN 1 ELSE 0 END) ASC,
               a.module_id ASC, a.position ASC, a.created_at ASC
      `,
      [courseId],
    );
    if (aRes.rows.length === 0) return [];
    const ids = aRes.rows.map((x) => x.id);
    const qRes = await pool.query<QuestionRow>(
      `SELECT id, attestation_id, position, prompt FROM attestation_questions WHERE attestation_id = ANY($1::uuid[]) ORDER BY attestation_id, position ASC`,
      [ids],
    );
    const qIds = qRes.rows.map((x) => x.id);
    const oRes =
      qIds.length === 0
        ? { rows: [] as OptionRow[] }
        : await pool.query<OptionRow>(
            `SELECT id, question_id, position, label, is_correct FROM attestation_question_options WHERE question_id = ANY($1::uuid[]) ORDER BY question_id, position ASC`,
            [qIds],
          );
    const optionsByQuestion = new Map<string, OptionRow[]>();
    for (const o of oRes.rows) {
      const arr = optionsByQuestion.get(o.question_id) ?? [];
      arr.push(o);
      optionsByQuestion.set(o.question_id, arr);
    }
    const questionsByAttestation = new Map<string, QuestionRow[]>();
    for (const q of qRes.rows) {
      const arr = questionsByAttestation.get(q.attestation_id) ?? [];
      arr.push(q);
      questionsByAttestation.set(q.attestation_id, arr);
    }
    return aRes.rows.map((r) => {
      const displayKind: 'intermediate' | 'final' = r.display_kind === 'final' ? 'final' : 'intermediate';
      const att: AttestationRow = {
        id: r.id,
        course_id: r.course_id,
        module_id: r.module_id,
        position: r.position,
        deleted_at: r.deleted_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        display_kind: displayKind,
      };
      const displayTitle = formatAttestationDisplayTitle(courseTitle, r.module_title, displayKind);
      return rowToExpertAttestation(att, questionsByAttestation.get(r.id) ?? [], optionsByQuestion, displayTitle);
    });
  }

  async getById(attestationId: string): Promise<ContractsV1.ExpertAttestationV1> {
    const ctx = await this.getContext(attestationId);
    const pool = this.requirePool();
    const qRes = await pool.query<QuestionRow>(
      `SELECT id, attestation_id, position, prompt FROM attestation_questions WHERE attestation_id = $1 ORDER BY position ASC`,
      [attestationId],
    );
    const qIds = qRes.rows.map((x) => x.id);
    const oRes =
      qIds.length === 0
        ? { rows: [] as OptionRow[] }
        : await pool.query<OptionRow>(
            `SELECT id, question_id, position, label, is_correct FROM attestation_question_options WHERE question_id = ANY($1::uuid[]) ORDER BY question_id, position ASC`,
            [qIds],
          );
    const optionsByQuestion = new Map<string, OptionRow[]>();
    for (const o of oRes.rows) {
      const arr = optionsByQuestion.get(o.question_id) ?? [];
      arr.push(o);
      optionsByQuestion.set(o.question_id, arr);
    }
    return rowToExpertAttestation(
      ctx.attestation,
      qRes.rows,
      optionsByQuestion,
      formatAttestationDisplayTitle(ctx.courseTitle, ctx.moduleTitle, ctx.attestation.display_kind),
    );
  }

  async create(params: {
    courseId: string;
    moduleId: string | null;
    displayKind?: 'intermediate' | 'final';
  }): Promise<ContractsV1.ExpertAttestationV1> {
    const pool = this.requirePool();
    const id = randomUUID();
    const moduleId = params.moduleId ?? null;
    const posRes =
      moduleId === null
        ? await pool.query<{ max: number | null }>(
            `
            SELECT MAX(position) AS max
            FROM course_attestations
            WHERE course_id = $1 AND module_id IS NULL AND deleted_at IS NULL
            `,
            [params.courseId],
          )
        : await pool.query<{ max: number | null }>(
            `
            SELECT MAX(position) AS max
            FROM course_attestations
            WHERE course_id = $1 AND module_id = $2 AND deleted_at IS NULL
            `,
            [params.courseId, moduleId],
          );
    const next = (posRes.rows[0]?.max ?? -1) + 1;
    const displayKind: 'intermediate' | 'final' =
      params.displayKind ?? (moduleId ? 'intermediate' : 'final');
    await pool.query(
      `INSERT INTO course_attestations (id, course_id, module_id, position, display_kind, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [id, params.courseId, moduleId, next, displayKind],
    );
    return this.getById(id);
  }

  async softDelete(attestationId: string): Promise<void> {
    const pool = this.requirePool();
    const res = await pool.query(
      `UPDATE course_attestations SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [attestationId],
    );
    if (res.rowCount === 0) {
      throw new NotFoundException({
        code: ErrorCodes.ATTESTATION_NOT_FOUND,
        message: 'Attestation not found',
      });
    }
  }

  async replaceQuestions(params: {
    attestationId: string;
    questions: ContractsV1.UpdateExpertAttestationQuestionV1[];
  }): Promise<ContractsV1.ExpertAttestationV1> {
    const pool = this.requirePool();
    const ctx = await this.getContext(params.attestationId);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Wipe existing options + questions; re-insert in the supplied order.
      await client.query(
        `DELETE FROM attestation_question_options WHERE question_id IN (
           SELECT id FROM attestation_questions WHERE attestation_id = $1
         )`,
        [params.attestationId],
      );
      await client.query(`DELETE FROM attestation_questions WHERE attestation_id = $1`, [params.attestationId]);
      let qIdx = 0;
      for (const q of params.questions) {
        const qId = q.id && /^[0-9a-f-]{36}$/i.test(q.id) ? q.id : randomUUID();
        await client.query(
          `INSERT INTO attestation_questions (id, attestation_id, position, prompt, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [qId, params.attestationId, qIdx, q.prompt.trim()],
        );
        let oIdx = 0;
        for (const o of q.options) {
          const oId = o.id && /^[0-9a-f-]{36}$/i.test(o.id) ? o.id : randomUUID();
          await client.query(
            `INSERT INTO attestation_question_options (id, question_id, position, label, is_correct, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [oId, qId, oIdx, o.label.trim(), Boolean(o.isCorrect)],
          );
          oIdx += 1;
        }
        qIdx += 1;
      }
      await client.query(`UPDATE course_attestations SET updated_at = NOW() WHERE id = $1`, [params.attestationId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    void ctx;
    return this.getById(params.attestationId);
  }

  /** For the student tree: short rows + latest attempt summary. */
  async listForStudentTree(params: {
    courseId: string;
    userId: string | null;
  }): Promise<ContractsV1.StudentAttestationTreeRowV1[]> {
    const pool = this.requirePool();
    const aRes = await pool.query<
      AttestationRow & { module_title: string | null; course_title: string; question_count: number | string }
    >(
      `
      SELECT
        a.*,
        m.title AS module_title,
        c.title AS course_title,
        COALESCE((SELECT COUNT(*) FROM attestation_questions q WHERE q.attestation_id = a.id), 0)::int AS question_count
      FROM course_attestations a
      JOIN courses c ON c.id = a.course_id AND c.deleted_at IS NULL
      LEFT JOIN course_modules m ON m.id = a.module_id AND m.deleted_at IS NULL
      WHERE a.course_id = $1 AND a.deleted_at IS NULL
      ORDER BY (CASE WHEN a.module_id IS NULL THEN 1 ELSE 0 END) ASC,
               a.module_id ASC, a.position ASC, a.created_at ASC
      `,
      [params.courseId],
    );
    if (aRes.rows.length === 0) return [];
    let latestByAttestation = new Map<string, AttemptRow>();
    if (params.userId) {
      const ids = aRes.rows.map((x) => x.id);
      const lRes = await pool.query<AttemptRow>(
        `
        SELECT DISTINCT ON (attestation_id)
          id, attestation_id, user_id, answers, correct_count, question_count, submitted_at
        FROM attestation_attempts
        WHERE attestation_id = ANY($1::uuid[]) AND user_id = $2
        ORDER BY attestation_id, submitted_at DESC
        `,
        [ids, params.userId],
      );
      for (const r of lRes.rows) {
        latestByAttestation.set(r.attestation_id, r);
      }
    }
    return aRes.rows.map((r) => ({
      id: r.id,
      scope: r.module_id ? ('module' as const) : ('course' as const),
      moduleId: r.module_id,
      displayTitle: formatAttestationDisplayTitle(
        r.course_title,
        r.module_title,
        r.display_kind === 'final' ? 'final' : 'intermediate',
      ),
      position: r.position,
      questionCount:
        typeof r.question_count === 'number' ? r.question_count : parseInt(String(r.question_count), 10) || 0,
      latestAttempt: latestByAttestation.get(r.id) ? summariseAttempt(latestByAttestation.get(r.id)!) : null,
    }));
  }

  async getStudentAttempt(params: {
    attestationId: string;
    userId: string;
  }): Promise<{ attempt: AttemptRow | null }> {
    const pool = this.requirePool();
    const res = await pool.query<AttemptRow>(
      `SELECT id, attestation_id, user_id, answers, correct_count, question_count, submitted_at
       FROM attestation_attempts
       WHERE attestation_id = $1 AND user_id = $2
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [params.attestationId, params.userId],
    );
    return { attempt: res.rows[0] ?? null };
  }

  /** Records an attempt; returns the persisted summary + per-question correctness map. */
  async submitAttempt(params: {
    attestationId: string;
    userId: string;
    answers: Record<string, string>;
  }): Promise<{
    attempt: AttemptRow;
    questions: Array<{
      questionId: string;
      prompt: string;
      position: number;
      correctOptionId: string;
      chosenOptionId: string | null;
      options: { id: string; position: number; label: string }[];
    }>;
  }> {
    const pool = this.requirePool();
    const qRes = await pool.query<QuestionRow>(
      `SELECT id, attestation_id, position, prompt FROM attestation_questions WHERE attestation_id = $1 ORDER BY position ASC`,
      [params.attestationId],
    );
    const qIds = qRes.rows.map((x) => x.id);
    const oRes =
      qIds.length === 0
        ? { rows: [] as OptionRow[] }
        : await pool.query<OptionRow>(
            `SELECT id, question_id, position, label, is_correct FROM attestation_question_options WHERE question_id = ANY($1::uuid[]) ORDER BY question_id, position ASC`,
            [qIds],
          );
    const optionsByQuestion = new Map<string, OptionRow[]>();
    for (const o of oRes.rows) {
      const arr = optionsByQuestion.get(o.question_id) ?? [];
      arr.push(o);
      optionsByQuestion.set(o.question_id, arr);
    }
    const correctByQuestion = new Map<string, string>();
    for (const [qid, opts] of optionsByQuestion.entries()) {
      const correct = opts.find((o) => o.is_correct);
      if (correct) correctByQuestion.set(qid, correct.id);
    }
    let correctCount = 0;
    for (const q of qRes.rows) {
      const chosen = params.answers[q.id];
      const target = correctByQuestion.get(q.id);
      if (chosen && target && chosen === target) correctCount += 1;
    }
    const id = randomUUID();
    const insertRes = await pool.query<AttemptRow>(
      `INSERT INTO attestation_attempts (id, attestation_id, user_id, answers, correct_count, question_count, submitted_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW())
       RETURNING id, attestation_id, user_id, answers, correct_count, question_count, submitted_at`,
      [id, params.attestationId, params.userId, JSON.stringify(params.answers), correctCount, qRes.rows.length],
    );
    const attempt = insertRes.rows[0];
    const questions = qRes.rows.map((q) => {
      const opts = (optionsByQuestion.get(q.id) ?? []).slice().sort((a, b) => a.position - b.position);
      return {
        questionId: q.id,
        prompt: q.prompt,
        position: q.position,
        correctOptionId: correctByQuestion.get(q.id) ?? '',
        chosenOptionId: params.answers[q.id] ?? null,
        options: opts.map((o) => ({ id: o.id, position: o.position, label: o.label })),
      };
    });
    return { attempt, questions };
  }

  async buildReviewFromAttempt(params: { attestationId: string; attempt: AttemptRow }): Promise<{
    questions: Array<{
      questionId: string;
      prompt: string;
      position: number;
      correctOptionId: string;
      chosenOptionId: string | null;
      options: { id: string; position: number; label: string }[];
    }>;
  }> {
    const pool = this.requirePool();
    const qRes = await pool.query<QuestionRow>(
      `SELECT id, attestation_id, position, prompt FROM attestation_questions WHERE attestation_id = $1 ORDER BY position ASC`,
      [params.attestationId],
    );
    const qIds = qRes.rows.map((x) => x.id);
    const oRes =
      qIds.length === 0
        ? { rows: [] as OptionRow[] }
        : await pool.query<OptionRow>(
            `SELECT id, question_id, position, label, is_correct FROM attestation_question_options WHERE question_id = ANY($1::uuid[]) ORDER BY question_id, position ASC`,
            [qIds],
          );
    const optionsByQuestion = new Map<string, OptionRow[]>();
    for (const o of oRes.rows) {
      const arr = optionsByQuestion.get(o.question_id) ?? [];
      arr.push(o);
      optionsByQuestion.set(o.question_id, arr);
    }
    const answers: Record<string, string> =
      params.attempt.answers && typeof params.attempt.answers === 'object'
        ? (params.attempt.answers as Record<string, string>)
        : {};
    const questions = qRes.rows.map((q) => {
      const opts = (optionsByQuestion.get(q.id) ?? []).slice().sort((a, b) => a.position - b.position);
      const correct = opts.find((o) => o.is_correct);
      return {
        questionId: q.id,
        prompt: q.prompt,
        position: q.position,
        correctOptionId: correct?.id ?? '',
        chosenOptionId: typeof answers[q.id] === 'string' ? (answers[q.id] as string) : null,
        options: opts.map((o) => ({ id: o.id, position: o.position, label: o.label })),
      };
    });
    return { questions };
  }

  attemptToSummary(row: AttemptRow): ContractsV1.AttestationAttemptSummaryV1 {
    return summariseAttempt(row);
  }

  buildDisplayTitle(
    courseTitle: string,
    moduleTitle: string | null,
    displayKind: 'intermediate' | 'final',
  ): string {
    return formatAttestationDisplayTitle(courseTitle, moduleTitle, displayKind);
  }
}
