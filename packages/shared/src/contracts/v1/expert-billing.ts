import { z } from 'zod';
import { BillingPeriodV1Schema, CheckoutProductV1Schema } from './orders.js';

/** GET /me/expert-billing — сводка для блока «Подписка эксперта» в профиле. */
export interface MeExpertBillingResponseV1 {
  /** Есть ли воркспейс эксперта, созданный этим пользователем. */
  hasExpertWorkspace: boolean;
  expertId: string | null;
  /** Название воркспейса (первый experts по created_at). */
  expertTitle: string | null;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  /** Полных суток до currentPeriodEnd (0 если сегодня последний день и ещё не истекло). */
  daysRemaining: number | null;
  autoRenew: boolean;
  /** Есть сохранённый RebillId для рекуррента. */
  rebillConfigured: boolean;
  /** Последний оплаченный тариф checkout (для кнопки «Продлить»). */
  checkoutProduct: 'platform_entry' | 'expert_pro' | null;
  /** Период последней оплаты (месяц / год). */
  billingPeriod: 'monthly' | 'yearly' | null;
  /** Дней, на которые продлевается период при оплате (30 или 365). */
  renewalPeriodDays: number;
}

export const MeExpertBillingResponseV1Schema = z.object({
  hasExpertWorkspace: z.boolean(),
  expertId: z.string().nullable(),
  expertTitle: z.string().nullable(),
  subscriptionStatus: z.string().min(1),
  currentPeriodEnd: z.string().nullable(),
  daysRemaining: z.number().int().min(0).nullable(),
  autoRenew: z.boolean(),
  rebillConfigured: z.boolean(),
  checkoutProduct: CheckoutProductV1Schema.nullable(),
  billingPeriod: BillingPeriodV1Schema.nullable(),
  renewalPeriodDays: z.number().int().min(1).max(366),
});

/** PATCH /me/expert-billing/auto-renew */
export interface PatchMeExpertBillingAutoRenewRequestV1 {
  autoRenew: boolean;
}

export const PatchMeExpertBillingAutoRenewRequestV1Schema = z.object({
  autoRenew: z.boolean(),
});

export interface PatchMeExpertBillingAutoRenewResponseV1 {
  ok: true;
  autoRenew: boolean;
}

export const PatchMeExpertBillingAutoRenewResponseV1Schema = z.object({
  ok: z.literal(true),
  autoRenew: z.boolean(),
});
