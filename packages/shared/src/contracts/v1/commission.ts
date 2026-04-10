import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

export interface CommissionV1 {
  id: Id;
  orderId: Id;
  referralCode: string;
  amountCents: number;
  createdAt: IsoDateTime;
}

export const CommissionV1Schema = z.object({
  id: z.string(),
  orderId: z.string(),
  referralCode: z.string().min(1).max(64),
  amountCents: z.number().int().min(0),
  createdAt: z.string(),
});

export interface MeCommissionsResponseV1 {
  items: CommissionV1[];
}

export const MeCommissionsResponseV1Schema = z.object({
  items: z.array(CommissionV1Schema),
});

