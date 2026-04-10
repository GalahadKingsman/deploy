import type { UserV1 } from './user.js';
import { z } from 'zod';
import { UserV1Schema } from './user.js';

/**
 * Telegram Auth Request V1
 */
export interface AuthTelegramRequestV1 {
  initData: string;
}

/**
 * Zod schema for AuthTelegramRequestV1
 */
export const AuthTelegramRequestV1Schema = z.object({
  initData: z.string().min(1),
});

/**
 * Telegram Auth Response V1
 */
export interface AuthTelegramResponseV1 {
  user: UserV1;
  accessToken: string;
}

/**
 * Zod schema for AuthTelegramResponseV1
 */
export const AuthTelegramResponseV1Schema = z.object({
  user: UserV1Schema,
  accessToken: z.string().min(1),
});
