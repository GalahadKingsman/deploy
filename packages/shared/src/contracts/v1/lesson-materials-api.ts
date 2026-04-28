import { z } from 'zod';
import type { LessonMaterialFileV1 } from './lesson-material.js';
import { LessonMaterialFileV1Schema } from './lesson-material.js';

export interface ListLessonMaterialsResponseV1 {
  items: LessonMaterialFileV1[];
}

export const ListLessonMaterialsResponseV1Schema = z.object({
  items: z.array(LessonMaterialFileV1Schema),
});

