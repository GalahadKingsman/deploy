import { z } from 'zod';

export interface MeReferralStatsResponseV1 {
  code: string;
  /** Legacy: зачисления по реф-коду в enrollments. */
  enrollmentsCount: number;
  /** Пользователи, привязанные по реф-ссылке (`referred_by_user_id`). */
  inviteesCount: number;
  /** Сколько приглашённых имеют хотя бы одну успешную оплату expert_subscription после привязки. */
  paidInviteesCount: number;
  ordersCount: number;
  paidOrdersCount: number;
  /** Сумма комиссий по реф-коду (валовое начисление). */
  commissionTotalCents: number;
  /** Доступно с учётом одобренных выводов: max(0, commissionTotalCents − сумма approved заявок). */
  netAccruedCents: number;
  /** Есть ли заявка на вывод в статусе «на рассмотрении». */
  hasPendingWithdrawal: boolean;
}

export const MeReferralStatsResponseV1Schema = z.object({
  code: z.string().min(1).max(64),
  enrollmentsCount: z.number().int().min(0),
  inviteesCount: z.number().int().min(0),
  paidInviteesCount: z.number().int().min(0),
  ordersCount: z.number().int().min(0),
  paidOrdersCount: z.number().int().min(0),
  commissionTotalCents: z.number().int().min(0),
  netAccruedCents: z.number().int().min(0),
  hasPendingWithdrawal: z.boolean(),
});

