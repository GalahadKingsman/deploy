import { z } from 'zod';
import { AssignmentV1Schema } from './assignment.js';
import { SubmissionV1Schema } from './submission.js';
import { SubmissionStatusV1Schema } from './assignment.js';

export interface GetLessonAssignmentResponseV1 {
  assignment: z.infer<typeof AssignmentV1Schema> | null;
}

export const GetLessonAssignmentResponseV1Schema = z.object({
  assignment: AssignmentV1Schema.nullable(),
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

export interface DecideSubmissionRequestV1 {
  status: z.infer<typeof SubmissionStatusV1Schema>;
}

export const DecideSubmissionRequestV1Schema = z.object({
  status: SubmissionStatusV1Schema,
});

