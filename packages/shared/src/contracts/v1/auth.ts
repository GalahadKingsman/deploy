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

/** POST /auth/site-bridge/issue — одноразовый код для переноса сессии на маркетинговый сайт. */
export interface AuthSiteBridgeIssueResponseV1 {
  code: string;
}

export const AuthSiteBridgeIssueResponseV1Schema = z.object({
  code: z.string().min(16).max(128),
});

/** POST /auth/site-bridge/claim */
export interface AuthSiteBridgeClaimRequestV1 {
  code: string;
}

export const AuthSiteBridgeClaimRequestV1Schema = z.object({
  code: z.string().min(16).max(128),
});
