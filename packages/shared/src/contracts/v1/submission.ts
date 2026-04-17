import { z } from 'zod';
import type { Id, IsoDateTime, UrlString } from './common.js';
import type { SubmissionStatusV1 } from './assignment.js';
import { SubmissionStatusV1Schema } from './assignment.js';

/**
 * Submission entity V1
 */
export interface SubmissionV1 {
  id: Id;
  assignmentId: Id;
  lessonId: Id;
  studentId: Id;
  createdAt: IsoDateTime;
  text?: string | null;
  link?: UrlString | null;
  fileKey?: string | null;
  status: SubmissionStatusV1;
  score?: number | null;
  reviewerComment?: string | null;
}

/**
 * Zod schema for SubmissionV1
 */
export const SubmissionV1Schema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  lessonId: z.string(),
  studentId: z.string(),
  createdAt: z.string(),
  text: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  fileKey: z.string().nullable().optional(),
  status: SubmissionStatusV1Schema,
  score: z.number().int().min(1).max(5).nullable().optional(),
  reviewerComment: z.string().max(4000).nullable().optional(),
});
