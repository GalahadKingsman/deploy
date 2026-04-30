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

/** POST /auth/register */
export interface AuthRegisterRequestV1 {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export const AuthRegisterRequestV1Schema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
});

/** POST /auth/login */
export interface AuthLoginRequestV1 {
  email: string;
  password: string;
}

export const AuthLoginRequestV1Schema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

/** Auth response for email+password */
export interface AuthPasswordResponseV1 {
  user: UserV1;
  accessToken: string;
}

export const AuthPasswordResponseV1Schema = z.object({
  user: UserV1Schema,
  accessToken: z.string().min(1),
});

/** POST /auth/password/reset/confirm */
export interface AuthPasswordResetConfirmRequestV1 {
  token: string;
  newPassword: string;
}

export const AuthPasswordResetConfirmRequestV1Schema = z.object({
  token: z.string().min(16).max(512),
  newPassword: z.string().min(8).max(200),
});

export interface AuthPasswordResetConfirmResponseV1 {
  ok: true;
}

export const AuthPasswordResetConfirmResponseV1Schema = z.object({
  ok: z.literal(true),
});

/** POST /admin/users/:userId/password-reset */
export interface AdminCreatePasswordResetRequestV1 {
  /** TTL for reset token; default 900 seconds. */
  ttlSeconds?: number;
}

export const AdminCreatePasswordResetRequestV1Schema = z.object({
  ttlSeconds: z.number().int().min(60).max(60 * 60 * 24).optional(),
});

export interface AdminCreatePasswordResetResponseV1 {
  token: string;
  expiresAt: string;
  /** URL path (admin UI can prepend origin). */
  resetPath: string;
}

export const AdminCreatePasswordResetResponseV1Schema = z.object({
  token: z.string().min(16).max(512),
  expiresAt: z.string(),
  resetPath: z.string().min(1),
});

/** GET /auth/password/reset/preview?token=... */
export interface AuthPasswordResetPreviewResponseV1 {
  email: string;
  expiresAt: string;
}

export const AuthPasswordResetPreviewResponseV1Schema = z.object({
  email: z.string().email().max(320),
  expiresAt: z.string(),
});

/** POST /auth/password/reset/request — письмо со ссылкой на смену пароля (лендинг). */
export interface AuthPasswordResetRequestRequestV1 {
  email: string;
}

export const AuthPasswordResetRequestRequestV1Schema = z.object({
  email: z.string().email().max(320),
});

export interface AuthPasswordResetRequestResponseV1 {
  ok: true;
  message: string;
}

export const AuthPasswordResetRequestResponseV1Schema = z.object({
  ok: z.literal(true),
  message: z.string().min(1),
});
