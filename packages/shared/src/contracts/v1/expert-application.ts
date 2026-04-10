import { z } from 'zod';
import type { Id } from './common.js';

/**
 * Expert application status V1 (Story 5.6)
 */
export type ExpertApplicationStatusV1 = 'pending' | 'approved' | 'rejected';

/**
 * Expert application entity V1
 */
export interface ExpertApplicationV1 {
  id: Id;
  userId: Id;
  status: ExpertApplicationStatusV1;
  note: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedByUserId: Id | null;
}

export const ExpertApplicationStatusV1Schema = z.enum(['pending', 'approved', 'rejected']);

export const ExpertApplicationV1Schema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: ExpertApplicationStatusV1Schema,
  note: z.string().nullable(),
  adminNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedByUserId: z.string().uuid().nullable(),
});
