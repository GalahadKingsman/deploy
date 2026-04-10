import { z } from 'zod';
import type { Id } from './common.js';

/**
 * Expert subscription plan V1 (stub: free_stub only)
 */
export type ExpertSubscriptionPlanV1 = 'free_stub';

/**
 * Expert subscription status V1
 */
export type ExpertSubscriptionStatusV1 = 'inactive' | 'active' | 'expired';

/**
 * Expert subscription entity V1
 */
export interface ExpertSubscriptionV1 {
  expertId: Id;
  plan: ExpertSubscriptionPlanV1;
  status: ExpertSubscriptionStatusV1;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  priceCents: number;
}

export const ExpertSubscriptionPlanV1Schema = z.literal('free_stub');

export const ExpertSubscriptionStatusV1Schema = z.enum(['inactive', 'active', 'expired']);

export const ExpertSubscriptionV1Schema = z.object({
  expertId: z.string().uuid(),
  plan: ExpertSubscriptionPlanV1Schema,
  status: ExpertSubscriptionStatusV1Schema,
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  priceCents: z.number().int().min(0),
});
