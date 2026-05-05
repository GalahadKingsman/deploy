import { z } from 'zod';

/** Карточка пригласившего пользователя для UI («Вас пригласил …»). Без email/телефона. */
export interface ReferralInviterV1 {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  /** Готовая строка для отображения, если у пригласившего нет ФИО. */
  displayName: string;
}

export const ReferralInviterV1Schema = z.object({
  userId: z.string().min(1),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  displayName: z.string().min(1).max(160),
});

/** GET /me/referral/inviter */
export interface GetMyReferralInviterResponseV1 {
  inviter: ReferralInviterV1 | null;
  /** ISO-дата первой привязки (users.referred_at), null если не привязан. */
  referredAt: string | null;
}

export const GetMyReferralInviterResponseV1Schema = z.object({
  inviter: ReferralInviterV1Schema.nullable(),
  referredAt: z.string().nullable(),
});

/** Карточка приглашённого: для блока «Кого вы пригласили». */
export interface ReferralInviteeV1 {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  displayName: string;
  /** owner/manager в команде эксперта с активной expert_subscriptions (status=active, period valid). */
  subscriptionActive: boolean;
  /** Сумма всех начисленных вам комиссий (копейки) по этому приглашённому за всё время. */
  commissionTotalCents: number;
  /** Дата привязки (users.referred_at). */
  referredAt: string;
  /** Дата перехода первого `expert_subscription` в paid после привязки (по этому приглашённому). null — оплат ещё не было. */
  firstPaidExpertSubscriptionAt: string | null;
}

export const ReferralInviteeV1Schema = z.object({
  userId: z.string().min(1),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  displayName: z.string().min(1).max(160),
  subscriptionActive: z.boolean(),
  commissionTotalCents: z.number().int().min(0),
  referredAt: z.string(),
  firstPaidExpertSubscriptionAt: z.string().nullable(),
});

/** GET /me/referral/invitees */
export interface ListMyReferralInviteesResponseV1 {
  items: ReferralInviteeV1[];
}

export const ListMyReferralInviteesResponseV1Schema = z.object({
  items: z.array(ReferralInviteeV1Schema),
});

/** GET /public/referral/preview?code=… — лёгкий публичный preview для модалки на лендинге. */
export interface ReferralPublicPreviewResponseV1 {
  /** Готовое к отображению имя пригласившего; пусто, если код невалиден или совпадает с собственным. */
  displayName: string | null;
  avatarUrl: string | null;
}

export const ReferralPublicPreviewResponseV1Schema = z.object({
  displayName: z.string().min(1).max(160).nullable(),
  avatarUrl: z.string().nullable(),
});
