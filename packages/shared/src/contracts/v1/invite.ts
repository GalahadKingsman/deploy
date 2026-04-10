import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

/**
 * Invite entity V1
 */
export interface InviteV1 {
  id: Id;
  code: string;
  courseId: Id;
  createdAt: IsoDateTime;
  expiresAt?: IsoDateTime | null;
  maxUses?: number | null;
  usesCount?: number;
}

/**
 * Zod schema for InviteV1
 */
export const InviteV1Schema = z.object({
  id: z.string(),
  code: z.string(),
  courseId: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  maxUses: z.number().nullable().optional(),
  usesCount: z.number().optional(),
});
