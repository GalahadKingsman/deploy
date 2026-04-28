import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

export interface LessonMaterialFileV1 {
  id: Id;
  lessonId: Id;
  fileKey: string;
  filename: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  createdAt: IsoDateTime;
}

export const LessonMaterialFileV1Schema = z.object({
  id: z.string(),
  lessonId: z.string(),
  fileKey: z.string(),
  filename: z.string(),
  contentType: z.string().nullable().optional(),
  sizeBytes: z.number().nullable().optional(),
  createdAt: z.string(),
});

