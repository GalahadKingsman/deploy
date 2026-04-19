import { z } from 'zod';
import { AssignmentFileV1Schema, AssignmentV1Schema } from './assignment.js';
import { SubmissionV1Schema } from './submission.js';
import { SubmissionStatusV1Schema } from './assignment.js';

export interface GetLessonAssignmentResponseV1 {
  assignment: z.infer<typeof AssignmentV1Schema> | null;
  files?: z.infer<typeof AssignmentFileV1Schema>[];
}

export const GetLessonAssignmentResponseV1Schema = z.object({
  assignment: AssignmentV1Schema.nullable(),
  files: z.array(AssignmentFileV1Schema).optional().default([]),
});

export interface CreateSubmissionRequestV1 {
  text?: string | null;
  link?: string | null;
  fileKey?: string | null;
}

export const CreateSubmissionRequestV1Schema = z.object({
  text: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  fileKey: z.string().nullable().optional(),
});

export interface CreateSubmissionResponseV1 {
  submission: z.infer<typeof SubmissionV1Schema>;
}

export const CreateSubmissionResponseV1Schema = z.object({
  submission: SubmissionV1Schema,
});

export interface ListLessonSubmissionsResponseV1 {
  items: z.infer<typeof SubmissionV1Schema>[];
}

export const ListLessonSubmissionsResponseV1Schema = z.object({
  items: z.array(SubmissionV1Schema),
});

/** Latest homework submissions for the student with course / module / lesson titles (platform, etc.). */
export const MyRecentSubmissionItemV1Schema = SubmissionV1Schema.extend({
  courseTitle: z.string(),
  moduleTitle: z.string(),
  lessonTitle: z.string(),
});

export type MyRecentSubmissionItemV1 = z.infer<typeof MyRecentSubmissionItemV1Schema>;

export interface ListMyRecentSubmissionsResponseV1 {
  items: MyRecentSubmissionItemV1[];
}

export const ListMyRecentSubmissionsResponseV1Schema = z.object({
  items: z.array(MyRecentSubmissionItemV1Schema),
});

export interface DecideSubmissionRequestV1 {
  status: z.infer<typeof SubmissionStatusV1Schema>;
  score?: number | null;
  reviewerComment?: string | null;
}

export const DecideSubmissionRequestV1Schema = z.object({
  status: SubmissionStatusV1Schema,
  score: z.number().int().min(1).max(5).nullable().optional(),
  reviewerComment: z.string().max(4000).nullable().optional(),
});

