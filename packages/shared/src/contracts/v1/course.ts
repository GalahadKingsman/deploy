import { z } from 'zod';
import type { Id, IsoDateTime, UrlString } from './common.js';

/** How students unlock lessons: sequential (next after complete) or open (all visible lessons at once). */
export type CourseLessonAccessModeV1 = 'sequential' | 'open';
export const CourseLessonAccessModeV1Schema = z.enum(['sequential', 'open']);

/**
 * Course entity V1
 */
export interface CourseV1 {
  id: Id;
  title: string;
  description?: string | null;
  coverUrl?: UrlString | null;
  authorName?: string | null;
  /** Ссылка для записи на курс (кнопка «Записаться»). */
  enrollmentContactUrl?: string | null;
  priceCents?: number;
  currency?: string;
  lessonsCount?: number;
  /** Число опубликованных модулей (для карточки курса / превью). */
  modulesCount?: number;
  updatedAt: IsoDateTime;
  status?: 'draft' | 'published' | 'archived';
  visibility?: 'private' | 'public';
  /** Omitted in older clients; when present, drives student lesson unlock (with per-lesson hide). */
  lessonAccessMode?: CourseLessonAccessModeV1;
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
  enrollmentContactUrl: z.string().nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.string().min(1).optional(),
  lessonsCount: z.number().int().min(0).optional(),
  modulesCount: z.number().int().min(0).optional(),
  updatedAt: z.string(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  lessonAccessMode: CourseLessonAccessModeV1Schema.optional(),
});
