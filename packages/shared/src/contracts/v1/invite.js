import { z } from 'zod';
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
