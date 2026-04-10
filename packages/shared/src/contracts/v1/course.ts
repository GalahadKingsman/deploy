import { z } from 'zod';
import type { Id, IsoDateTime, UrlString } from './common.js';

/**
 * Course entity V1
 */
export interface CourseV1 {
  id: Id;
  title: string;
  description?: string | null;
  coverUrl?: UrlString | null;
  authorName?: string | null;
  priceCents?: number;
  currency?: string;
  lessonsCount?: number;
  updatedAt: IsoDateTime;
  status?: 'draft' | 'published' | 'archived';
  visibility?: 'private' | 'public';
}

/**
 * Zod schema for CourseV1
 */
export const CourseV1Schema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().min(1).optional(),
  lessonsCount: z.number().optional(),
  updatedAt: z.string(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
});
