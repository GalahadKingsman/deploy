import { z } from 'zod';

export interface PaymentRefundRequestV1 {
  id: string;
  orderId: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface ListPaymentRefundRequestsResponseV1 {
  items: PaymentRefundRequestV1[];
}

export const PaymentRefundRequestV1Schema = z.object({
  id: z.string(),
  orderId: z.string(),
  status: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export const ListPaymentRefundRequestsResponseV1Schema = z.object({
  items: z.array(PaymentRefundRequestV1Schema),
});
