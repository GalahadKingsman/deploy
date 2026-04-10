import { z } from 'zod';
/**
 * Zod schema for CourseV1
 */
export const CourseV1Schema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
  lessonsCount: z.number().optional(),
  updatedAt: z.string(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
});
