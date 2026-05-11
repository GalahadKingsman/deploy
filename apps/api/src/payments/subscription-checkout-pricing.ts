import type { ContractsV1 } from '@tracked/shared';

/** Год: −30% к месячной, затем ×12, округление до целых копеек (как в ТЗ). */
export function computeExpertSubscriptionCheckout(params: {
  product: ContractsV1.CheckoutProductV1;
  billingPeriod: ContractsV1.BillingPeriodV1;
  platformEntryMonthlyCents: number;
  expertProMonthlyCents: number;
}): { amountCents: number; periodDays: number } {
  const monthly =
    params.product === 'platform_entry' ? params.platformEntryMonthlyCents : params.expertProMonthlyCents;
  if (!Number.isFinite(monthly) || monthly <= 0) {
    throw new Error('Invalid monthly price');
  }
  const periodDays = params.billingPeriod === 'yearly' ? 365 : 30;
  const amountCents =
    params.billingPeriod === 'yearly' ? Math.round(monthly * 0.7 * 12) : Math.round(monthly);
  return { amountCents, periodDays };
}
