import { z } from 'zod';

export interface PartnerPayoutRequestV1 {
  id: string;
  amountCents: number;
  status: string;
  createdAt: string;
}

export interface ListMyPayoutRequestsResponseV1 {
  items: PartnerPayoutRequestV1[];
}

export interface CreatePartnerPayoutRequestV1 {
  amountCents: number;
}

export const CreatePartnerPayoutRequestV1Schema = z.object({
  amountCents: z.number().int().min(1).max(100_000_000),
});

export const PartnerPayoutRequestV1Schema = z.object({
  id: z.string(),
  amountCents: z.number().int().min(0),
  status: z.string(),
  createdAt: z.string(),
});

export const ListMyPayoutRequestsResponseV1Schema = z.object({
  items: z.array(PartnerPayoutRequestV1Schema),
});
