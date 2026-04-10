import { z } from 'zod';
/**
 * Zod schema for LessonVideoV1
 */
const LessonVideoV1Schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('youtube'), youtubeId: z.string() }),
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
  updatedAt: z.string(),
  video: LessonVideoV1Schema.optional(),
});
