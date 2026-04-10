import { z } from 'zod';

export interface MeReferralStatsResponseV1 {
  code: string;
  enrollmentsCount: number;
  ordersCount: number;
  paidOrdersCount: number;
  commissionTotalCents: number;
}

export const MeReferralStatsResponseV1Schema = z.object({
  code: z.string().min(1).max(64),
  enrollmentsCount: z.number().int().min(0),
  ordersCount: z.number().int().min(0),
  paidOrdersCount: z.number().int().min(0),
  commissionTotalCents: z.number().int().min(0),
});

