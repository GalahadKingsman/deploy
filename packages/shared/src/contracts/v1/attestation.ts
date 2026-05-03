import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

export type AttestationScopeV1 = 'module' | 'course';

export const AttestationScopeV1Schema = z.union([z.literal('module'), z.literal('course')]);

export interface AttestationOptionV1 {
  id: Id;
  position: number;
  label: string;
  isCorrect: boolean;
}

export const AttestationOptionV1Schema = z.object({
  id: z.string(),
  position: z.number().int(),
  label: z.string(),
  isCorrect: z.boolean(),
});

export interface AttestationQuestionV1 {
  id: Id;
  position: number;
  prompt: string;
  options: AttestationOptionV1[];
}

export const AttestationQuestionV1Schema = z.object({
  id: z.string(),
  position: z.number().int(),
  prompt: z.string(),
  options: z.array(AttestationOptionV1Schema),
});

export interface ExpertAttestationV1 {
  id: Id;
  courseId: Id;
  moduleId: Id | null;
  scope: AttestationScopeV1;
  position: number;
  displayTitle: string;
  questions: AttestationQuestionV1[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const ExpertAttestationV1Schema = z.object({
  id: z.string(),
  courseId: z.string(),
  moduleId: z.string().nullable(),
  scope: AttestationScopeV1Schema,
  position: z.number().int(),
  displayTitle: z.string(),
  questions: z.array(AttestationQuestionV1Schema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface ListExpertAttestationsResponseV1 {
  items: ExpertAttestationV1[];
}

export const ListExpertAttestationsResponseV1Schema = z.object({
  items: z.array(ExpertAttestationV1Schema),
});

export interface CreateExpertAttestationRequestV1 {
  /** null / отсутствует => итоговая аттестация к курсу */
  moduleId?: Id | null;
}

/** Пустое тело, пустая строка или отсутствие поля — итоговая аттестация к курсу. */
export const CreateExpertAttestationRequestV1Schema = z.object({
  moduleId: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.union([z.string().min(1), z.null()]).optional(),
  ),
});

export interface UpdateExpertAttestationQuestionOptionV1 {
  id?: Id;
  label: string;
  isCorrect: boolean;
}

export const UpdateExpertAttestationQuestionOptionV1Schema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(2000),
  isCorrect: z.boolean(),
});

export interface UpdateExpertAttestationQuestionV1 {
  id?: Id;
  prompt: string;
  options: UpdateExpertAttestationQuestionOptionV1[];
}

export const UpdateExpertAttestationQuestionV1Schema = z
  .object({
    id: z.string().optional(),
    prompt: z.string().min(1).max(4000),
    options: z.array(UpdateExpertAttestationQuestionOptionV1Schema).min(2).max(20),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: 'Each question must have exactly one correct option',
    path: ['options'],
  });

export interface UpdateExpertAttestationRequestV1 {
  questions: UpdateExpertAttestationQuestionV1[];
}

export const UpdateExpertAttestationRequestV1Schema = z.object({
  questions: z.array(UpdateExpertAttestationQuestionV1Schema).max(200),
});

export interface AttestationAttemptSummaryV1 {
  attemptId: Id;
  correctCount: number;
  questionCount: number;
  /** 0..100 (rounded) */
  percent: number;
  submittedAt: IsoDateTime;
}

export const AttestationAttemptSummaryV1Schema = z.object({
  attemptId: z.string(),
  correctCount: z.number().int().min(0),
  questionCount: z.number().int().min(0),
  percent: z.number().int().min(0).max(100),
  submittedAt: z.string(),
});

export interface StudentAttestationTreeRowV1 {
  id: Id;
  scope: AttestationScopeV1;
  moduleId: Id | null;
  displayTitle: string;
  position: number;
  questionCount: number;
  latestAttempt: AttestationAttemptSummaryV1 | null;
}

export const StudentAttestationTreeRowV1Schema = z.object({
  id: z.string(),
  scope: AttestationScopeV1Schema,
  moduleId: z.string().nullable(),
  displayTitle: z.string(),
  position: z.number().int(),
  questionCount: z.number().int().min(0),
  latestAttempt: AttestationAttemptSummaryV1Schema.nullable(),
});

export interface StudentAttestationQuestionForAttemptV1 {
  id: Id;
  position: number;
  prompt: string;
  options: { id: Id; position: number; label: string }[];
}

export const StudentAttestationQuestionForAttemptV1Schema = z.object({
  id: z.string(),
  position: z.number().int(),
  prompt: z.string(),
  options: z.array(
    z.object({
      id: z.string(),
      position: z.number().int(),
      label: z.string(),
    }),
  ),
});

export interface GetStudentAttestationForAttemptResponseV1 {
  id: Id;
  courseId: Id;
  moduleId: Id | null;
  scope: AttestationScopeV1;
  displayTitle: string;
  questions: StudentAttestationQuestionForAttemptV1[];
  latestAttempt: AttestationAttemptSummaryV1 | null;
}

export const GetStudentAttestationForAttemptResponseV1Schema = z.object({
  id: z.string(),
  courseId: z.string(),
  moduleId: z.string().nullable(),
  scope: AttestationScopeV1Schema,
  displayTitle: z.string(),
  questions: z.array(StudentAttestationQuestionForAttemptV1Schema),
  latestAttempt: AttestationAttemptSummaryV1Schema.nullable(),
});

export interface SubmitStudentAttestationRequestV1 {
  /** questionId -> chosen optionId */
  answers: Record<Id, Id>;
}

export const SubmitStudentAttestationRequestV1Schema = z.object({
  answers: z.record(z.string(), z.string()),
});

export interface StudentAttestationReviewQuestionV1 {
  questionId: Id;
  prompt: string;
  position: number;
  chosenOptionId: Id | null;
  correctOptionId: Id;
  options: { id: Id; position: number; label: string }[];
}

export const StudentAttestationReviewQuestionV1Schema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  position: z.number().int(),
  chosenOptionId: z.string().nullable(),
  correctOptionId: z.string(),
  options: z.array(
    z.object({
      id: z.string(),
      position: z.number().int(),
      label: z.string(),
    }),
  ),
});

export interface SubmitStudentAttestationResponseV1 {
  attempt: AttestationAttemptSummaryV1;
  questions: StudentAttestationReviewQuestionV1[];
}

export const SubmitStudentAttestationResponseV1Schema = z.object({
  attempt: AttestationAttemptSummaryV1Schema,
  questions: z.array(StudentAttestationReviewQuestionV1Schema),
});

export interface GetStudentAttestationReviewResponseV1 {
  id: Id;
  scope: AttestationScopeV1;
  moduleId: Id | null;
  displayTitle: string;
  attempt: AttestationAttemptSummaryV1 | null;
  questions: StudentAttestationReviewQuestionV1[];
}

export const GetStudentAttestationReviewResponseV1Schema = z.object({
  id: z.string(),
  scope: AttestationScopeV1Schema,
  moduleId: z.string().nullable(),
  displayTitle: z.string(),
  attempt: AttestationAttemptSummaryV1Schema.nullable(),
  questions: z.array(StudentAttestationReviewQuestionV1Schema),
});

export interface ListStudentCourseAttestationsResponseV1 {
  items: StudentAttestationTreeRowV1[];
}

export const ListStudentCourseAttestationsResponseV1Schema = z.object({
  items: z.array(StudentAttestationTreeRowV1Schema),
});
