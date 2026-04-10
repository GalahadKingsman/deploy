import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

export type SubmissionStatusV1 = 'submitted' | 'rework' | 'accepted';
export const SubmissionStatusV1Schema = z.enum(['submitted', 'rework', 'accepted']);

export interface AssignmentV1 {
  id: Id;
  lessonId: Id;
  promptMarkdown?: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const AssignmentV1Schema = z.object({
  id: z.string(),
  lessonId: z.string(),
  promptMarkdown: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface UpsertAssignmentRequestV1 {
  promptMarkdown?: string | null;
}

export const UpsertAssignmentRequestV1Schema = z.object({
  promptMarkdown: z.string().nullable().optional(),
});

