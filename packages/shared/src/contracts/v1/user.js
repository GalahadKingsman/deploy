import { z } from 'zod';
/**
 * Zod schema for UserV1
 */
export const UserV1Schema = z.object({
  id: z.string(),
  telegramUserId: z.string().optional(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
