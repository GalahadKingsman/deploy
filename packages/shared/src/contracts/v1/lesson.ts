import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

/**
 * Lesson video content
 */
export type LessonVideoV1 =
  | { kind: 'youtube'; youtubeId: string }
  | { kind: 'rutube'; url: string }
  | { kind: 'upload'; key: string; mime: string; size: number; originalFilename: string }
  | { kind: 'none' };

/**
 * Lesson entity V1
 */
export interface LessonV1 {
  id: Id;
  courseId: Id;
  title: string;
  order: number;
  contentMarkdown?: string | null;
  slider?: { images: { key: string }[] } | null;
  presentation?: { pptxKey: string; pdfKey: string; originalFilename: string } | null;
  updatedAt: IsoDateTime;
  video?: LessonVideoV1;
}

/**
 * Zod schema for LessonVideoV1
 */
const LessonVideoV1Schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('youtube'), youtubeId: z.string() }),
  z.object({
    kind: z.literal('rutube'),
    url: z.string().url(),
  }),
  z.object({
    kind: z.literal('upload'),
    key: z.string(),
    mime: z.string(),
    size: z.number(),
    originalFilename: z.string(),
  }),
  z.object({ kind: z.literal('none') }),
]);

/**
 * Zod schema for LessonV1
 */
export const LessonV1Schema = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  order: z.number(),
  contentMarkdown: z.string().nullable().optional(),
  slider: z
    .object({
      images: z.array(
        z.object({
          key: z.string().min(1),
        }),
      ),
    })
    .nullable()
    .optional(),
  presentation: z
    .object({
      pptxKey: z.string().min(1),
      pdfKey: z.string().min(1),
      originalFilename: z.string().min(1),
    })
    .nullable()
    .optional(),
  updatedAt: z.string(),
  video: LessonVideoV1Schema.optional(),
});
