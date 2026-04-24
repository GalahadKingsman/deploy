import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';
import type { LessonVideoV1 } from './lesson.js';
import { LessonV1Schema } from './lesson.js';

// Reuse the existing LessonVideoV1 schema via LessonV1Schema.shape.video
const LessonVideoV1Schema = LessonV1Schema.shape.video.unwrap().optional();

export interface ExpertLessonV1 {
  id: Id;
  courseId: Id;
  moduleId: Id;
  title: string;
  position: number;
  contentMarkdown?: string | null;
  slider?: { images: { key: string }[] } | null;
  video?: LessonVideoV1;
  deletedAt?: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const ExpertLessonV1Schema = z.object({
  id: z.string(),
  courseId: z.string(),
  moduleId: z.string(),
  title: z.string(),
  position: z.number(),
  contentMarkdown: z.string().nullable().optional(),
  slider: LessonV1Schema.shape.slider,
  video: LessonVideoV1Schema,
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface ListExpertLessonsResponseV1 {
  items: ExpertLessonV1[];
}

export const ListExpertLessonsResponseV1Schema = z.object({
  items: z.array(ExpertLessonV1Schema),
});

export interface CreateExpertLessonRequestV1 {
  title: string;
  contentMarkdown?: string | null;
  slider?: { images: { key: string }[] } | null;
  video?: LessonVideoV1;
}

export const CreateExpertLessonRequestV1Schema = z.object({
  title: z.string().min(1),
  contentMarkdown: z.string().nullable().optional(),
  slider: LessonV1Schema.shape.slider,
  video: LessonVideoV1Schema.optional(),
});

export interface UpdateExpertLessonRequestV1 {
  title?: string;
  contentMarkdown?: string | null;
  slider?: { images: { key: string }[] } | null;
  video?: LessonVideoV1;
}

export const UpdateExpertLessonRequestV1Schema = z.object({
  title: z.string().min(1).optional(),
  contentMarkdown: z.string().nullable().optional(),
  slider: LessonV1Schema.shape.slider,
  video: LessonVideoV1Schema.optional(),
});

export interface ReorderExpertLessonsRequestV1 {
  items: { id: Id; position: number }[];
}

export const ReorderExpertLessonsRequestV1Schema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      position: z.number().int().min(0),
    }),
  ),
});

