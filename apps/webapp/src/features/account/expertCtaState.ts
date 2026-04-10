/**
 * Expert CTA state for "Стать экспертом" block (Story 5.4)
 * Same semantics as API guard: ACTIVE iff status === 'active' && (currentPeriodEnd == null || currentPeriodEnd > now)
 */

import type { ContractsV1 } from '@tracked/shared';

export type ExpertCtaState = 'none' | 'expired' | 'active';

export interface ExpertCtaData {
  state: ExpertCtaState;
  subscription: ContractsV1.ExpertSubscriptionV1 | null;
}

/**
 * Derive single CTA state from subscription data.
 * - ACTIVE: status === 'active' && (currentPeriodEnd == null || currentPeriodEnd > now)
 * - EXPIRED: subscription exists but not active
 * - NONE: no subscription/expert data
 */
export function deriveExpertCtaState(
  subscription: ContractsV1.ExpertSubscriptionV1 | null | undefined,
): ExpertCtaState {
  if (!subscription) {
    return 'none';
  }

  const now = Date.now();
  const end = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : null;

  const isActive = subscription.status === 'active' && (end === null || end > now);

  return isActive ? 'active' : 'expired';
}
