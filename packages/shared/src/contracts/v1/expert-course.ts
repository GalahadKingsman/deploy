import { z } from 'zod';
import type { Id, IsoDateTime, UrlString } from './common.js';

export type CourseStatusV1 = 'draft' | 'published' | 'archived';
export const CourseStatusV1Schema = z.enum(['draft', 'published', 'archived']);

export type CourseVisibilityV1 = 'private' | 'public';
export const CourseVisibilityV1Schema = z.enum(['private', 'public']);

/**
 * Expert-owned course for authoring (EPIC 6).
 * This is distinct from the student-facing `CourseV1` shape (which is looser and UI-oriented).
 */
export interface ExpertCourseV1 {
  id: Id;
  expertId: Id;
  title: string;
  description?: string | null;
  coverUrl?: UrlString | null;
  /** Price in minor units (e.g. kopecks for RUB). */
  priceCents: number;
  currency: string;
  status: CourseStatusV1;
  visibility: CourseVisibilityV1;
  publishedAt?: IsoDateTime | null;
  deletedAt?: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const ExpertCourseV1Schema = z.object({
  id: z.string(),
  expertId: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  priceCents: z.number().int().min(0),
  currency: z.string().min(1),
  status: CourseStatusV1Schema,
  visibility: CourseVisibilityV1Schema,
  publishedAt: z.string().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface ListExpertCoursesResponseV1 {
  items: ExpertCourseV1[];
}

export const ListExpertCoursesResponseV1Schema = z.object({
  items: z.array(ExpertCourseV1Schema),
});

export interface CreateExpertCourseRequestV1 {
  title: string;
  description?: string | null;
  coverUrl?: UrlString | null;
  priceCents?: number;
  currency?: string;
  visibility?: CourseVisibilityV1;
}

export const CreateExpertCourseRequestV1Schema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().min(1).max(8).optional(),
  visibility: CourseVisibilityV1Schema.optional(),
});

export interface UpdateExpertCourseRequestV1 {
  title?: string;
  description?: string | null;
  coverUrl?: UrlString | null;
  priceCents?: number;
  currency?: string;
  visibility?: CourseVisibilityV1;
}

export const UpdateExpertCourseRequestV1Schema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().min(1).max(8).optional(),
  visibility: CourseVisibilityV1Schema.optional(),
});

