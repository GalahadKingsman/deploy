import { z } from 'zod';
import type { IsoDateTime } from './common.js';

/** Период агрегации дашборда (календарный месяц в UTC). */
export interface ExpertDashboardPeriodV1 {
  year: number;
  month: number;
  /** Начало месяца UTC, ISO 8601. */
  startIso: IsoDateTime;
  /** Конец месяца (исключительно), ISO 8601 — первый момент следующего месяца UTC. */
  endExclusiveIso: IsoDateTime;
}

export interface ExpertDashboardStudentsV1 {
  totalUnique: number;
  newEnrollmentsInMonth: number;
}

export interface ExpertDashboardCoursesSummaryV1 {
  publishedCount: number;
  draftCount: number;
}

export interface ExpertDashboardReferralV1 {
  /** Сумма реферальных начислений за выбранный месяц (рубли, целое). */
  totalRubInMonth: number;
  /** Изменение к предыдущему календарному месяцу: total(M) − total(M−1), рубли. */
  deltaRubVsPreviousMonth: number;
}

export type ExpertDashboardActivityKindV1 = 'homework_submitted' | 'enrollment' | 'lesson_completed';

export interface ExpertDashboardActivityItemV1 {
  kind: ExpertDashboardActivityKindV1;
  occurredAt: IsoDateTime;
  actorDisplayName: string;
  actorInitials: string;
  actorAvatarUrl: string | null;
  description: string;
  badgeText: string;
  badgeVariant: 'new' | 'live' | 'draft' | 'muted';
}

export interface ExpertDashboardHomeworkPreviewItemV1 {
  submissionId: string;
  lessonId: string;
  assignmentId: string;
  studentId: string;
  createdAt: IsoDateTime;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentUsername: string | null;
  studentEmail: string | null;
  studentAvatarUrl: string | null;
  courseTitle: string;
  moduleTitle: string;
  lessonTitle: string;
  answerPreview: string;
  submissionStatus: string;
  isOpened: boolean;
  uiStatus: 'new' | 'unchecked' | 'checked';
}

export interface ExpertDashboardHomeworkV1 {
  /** Очередь «нужна проверка»: latest per (студент, урок) не accepted, дата latest в выбранном месяце. */
  pendingInMonth: number;
  /** Новые сегодня (UTC): только если выбран текущий месяц; иначе 0. */
  newTodayUtc: number;
  previewItems: ExpertDashboardHomeworkPreviewItemV1[];
}

export interface ExpertDashboardResponseV1 {
  period: ExpertDashboardPeriodV1;
  students: ExpertDashboardStudentsV1;
  courses: ExpertDashboardCoursesSummaryV1;
  referral: ExpertDashboardReferralV1;
  homework: ExpertDashboardHomeworkV1;
  activity: { items: ExpertDashboardActivityItemV1[] };
}

export const ExpertDashboardPeriodV1Schema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  startIso: z.string(),
  endExclusiveIso: z.string(),
});

export const ExpertDashboardStudentsV1Schema = z.object({
  totalUnique: z.number().int().min(0),
  newEnrollmentsInMonth: z.number().int().min(0),
});

export const ExpertDashboardCoursesSummaryV1Schema = z.object({
  publishedCount: z.number().int().min(0),
  draftCount: z.number().int().min(0),
});

export const ExpertDashboardReferralV1Schema = z.object({
  totalRubInMonth: z.number().int().min(0),
  deltaRubVsPreviousMonth: z.number().int(),
});

export const ExpertDashboardActivityKindV1Schema = z.enum(['homework_submitted', 'enrollment', 'lesson_completed']);

export const ExpertDashboardActivityItemV1Schema = z.object({
  kind: ExpertDashboardActivityKindV1Schema,
  occurredAt: z.string(),
  actorDisplayName: z.string(),
  actorInitials: z.string(),
  actorAvatarUrl: z.string().nullable(),
  description: z.string(),
  badgeText: z.string(),
  badgeVariant: z.enum(['new', 'live', 'draft', 'muted']),
});

export const ExpertDashboardHomeworkPreviewItemV1Schema = z.object({
  submissionId: z.string(),
  lessonId: z.string(),
  assignmentId: z.string(),
  studentId: z.string(),
  createdAt: z.string(),
  studentFirstName: z.string().nullable(),
  studentLastName: z.string().nullable(),
  studentUsername: z.string().nullable(),
  studentEmail: z.string().nullable(),
  studentAvatarUrl: z.string().nullable(),
  courseTitle: z.string(),
  moduleTitle: z.string(),
  lessonTitle: z.string(),
  answerPreview: z.string(),
  submissionStatus: z.string(),
  isOpened: z.boolean(),
  uiStatus: z.enum(['new', 'unchecked', 'checked']),
});

export const ExpertDashboardHomeworkV1Schema = z.object({
  pendingInMonth: z.number().int().min(0),
  newTodayUtc: z.number().int().min(0),
  previewItems: z.array(ExpertDashboardHomeworkPreviewItemV1Schema),
});

export const ExpertDashboardResponseV1Schema = z.object({
  period: ExpertDashboardPeriodV1Schema,
  students: ExpertDashboardStudentsV1Schema,
  courses: ExpertDashboardCoursesSummaryV1Schema,
  referral: ExpertDashboardReferralV1Schema,
  homework: ExpertDashboardHomeworkV1Schema,
  activity: z.object({ items: z.array(ExpertDashboardActivityItemV1Schema) }),
});
