import { z } from 'zod';
import { UserV1Schema } from './user.js';
/**
 * Zod schema for AuthTelegramRequestV1
 */
export const AuthTelegramRequestV1Schema = z.object({
  initData: z.string().min(1),
});
/**
 * Zod schema for AuthTelegramResponseV1
 */
export const AuthTelegramResponseV1Schema = z.object({
  user: UserV1Schema,
});
