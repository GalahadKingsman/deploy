import { z } from 'zod';
/**
 * Zod schema for SubmissionV1
 */
export const SubmissionV1Schema = z.object({
  id: z.string(),
  lessonId: z.string(),
  courseId: z.string(),
  studentId: z.string(),
  createdAt: z.string(),
  text: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  fileKey: z.string().nullable().optional(),
  status: z.enum(['submitted', 'rework', 'accepted']).optional(),
});
