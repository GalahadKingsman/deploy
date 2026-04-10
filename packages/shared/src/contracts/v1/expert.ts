import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

/**
 * Expert entity V1
 */
export interface ExpertV1 {
  id: Id;
  title: string;
  slug?: string | null;
  createdByUserId: Id;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * Zod schema for ExpertV1
 */
export const ExpertV1Schema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  slug: z.string().nullable().optional(),
  createdByUserId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
