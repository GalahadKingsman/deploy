import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

export type SubmissionStatusV1 = 'submitted' | 'rework' | 'accepted';
export const SubmissionStatusV1Schema = z.enum(['submitted', 'rework', 'accepted']);

export interface AssignmentFileV1 {
  id: Id;
  assignmentId: Id;
  fileKey: string;
  filename: string;
  contentType?: string | null;
  createdAt: IsoDateTime;
}

export const AssignmentFileV1Schema = z.object({
  id: z.string(),
  assignmentId: z.string(),
  fileKey: z.string(),
  filename: z.string(),
  contentType: z.string().nullable().optional(),
  createdAt: z.string(),
});

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

