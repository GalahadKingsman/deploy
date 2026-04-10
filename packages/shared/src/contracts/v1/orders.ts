import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

export type OrderStatusV1 = 'created' | 'paid' | 'cancelled' | 'failed' | 'refunded';
export const OrderStatusV1Schema = z.enum(['created', 'paid', 'cancelled', 'failed', 'refunded']);

export interface OrderV1 {
  id: Id;
  courseId: Id;
  userId: Id;
  amountCents: number;
  currency: string;
  status: OrderStatusV1;
  provider?: string;
  providerPaymentId?: string | null;
  providerStatus?: string | null;
  payUrl?: string | null;
  receiptEmail?: string | null;
  receiptPhone?: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const OrderV1Schema = z.object({
  id: z.string(),
  courseId: z.string(),
  userId: z.string(),
  amountCents: z.number().int().min(0),
  currency: z.string().min(1),
  status: OrderStatusV1Schema,
  provider: z.string().min(1).optional(),
  providerPaymentId: z.string().nullable().optional(),
  providerStatus: z.string().nullable().optional(),
  payUrl: z.string().url().nullable().optional(),
  receiptEmail: z.string().nullable().optional(),
  receiptPhone: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface CreateCourseCheckoutRequestV1 {
  referralCode?: string | null;
  email?: string | null;
  phone?: string | null;
}

export const CreateCourseCheckoutRequestV1Schema = z.object({
  referralCode: z.string().min(1).max(64).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(5).max(32).nullable().optional(),
});

export interface CreateCourseCheckoutResponseV1 {
  order: OrderV1;
  payUrl?: string | null;
}

export const CreateCourseCheckoutResponseV1Schema = z.object({
  order: OrderV1Schema,
  payUrl: z.string().url().nullable().optional(),
});

export interface MeOrdersResponseV1 {
  items: OrderV1[];
}

export const MeOrdersResponseV1Schema = z.object({
  items: z.array(OrderV1Schema),
});

