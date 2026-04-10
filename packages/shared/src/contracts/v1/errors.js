import { z } from 'zod';
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
