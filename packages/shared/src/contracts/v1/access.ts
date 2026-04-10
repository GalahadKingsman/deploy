import { z } from 'zod';
import type { Id } from './common.js';

export interface ActivateInviteRequestV1 {
  code: string;
  referralCode?: string | null;
}

export const ActivateInviteRequestV1Schema = z.object({
  code: z.string().min(1),
  referralCode: z.string().min(1).max(64).nullable().optional(),
});

export interface ActivateInviteResponseV1 {
  ok: true;
  courseId: Id;
}

export const ActivateInviteResponseV1Schema = z.object({
  ok: z.literal(true),
  courseId: z.string(),
});

export interface CompleteLessonRequestV1 {
  // reserved for future (idempotency keys, timestamps)
}

export const CompleteLessonRequestV1Schema = z.object({});

export interface CompleteLessonResponseV1 {
  ok: true;
  lessonId: Id;
}

export const CompleteLessonResponseV1Schema = z.object({
  ok: z.literal(true),
  lessonId: z.string(),
});

