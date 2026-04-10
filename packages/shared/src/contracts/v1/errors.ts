import { z } from 'zod';
import type { ErrorCode } from '../../errors/codes.js';

/**
 * API Error V1
 */
export interface ApiErrorV1 {
  code: ErrorCode | string;
  message: string;
  requestId: string;
  details?: unknown;
}

/**
 * API Error Response V1
 */
export interface ApiErrorResponseV1 {
  error: ApiErrorV1;
}

/**
 * Zod schema for ApiErrorV1
 */
export const ApiErrorV1Schema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  details: z.unknown().optional(),
});

/**
 * Zod schema for ApiErrorResponseV1
 */
export const ApiErrorResponseV1Schema = z.object({
  error: ApiErrorV1Schema,
});
