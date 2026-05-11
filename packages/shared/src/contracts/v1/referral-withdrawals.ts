import { z } from 'zod';

export type ReferralWithdrawalStatusV1 = 'pending' | 'approved' | 'rejected';

export const ReferralWithdrawalStatusV1Schema = z.enum(['pending', 'approved', 'rejected']);

export interface ReferralWithdrawalRequestV1 {
  id: string;
  userId: string;
  amountCents: number;
  cardPan: string;
  phone: string;
  bankName: string;
  status: ReferralWithdrawalStatusV1;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
}

export const ReferralWithdrawalRequestV1Schema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  cardPan: z.string().min(1),
  phone: z.string().min(1),
  bankName: z.string().min(1),
  status: ReferralWithdrawalStatusV1Schema,
  createdAt: z.string(),
  updatedAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedByUserId: z.string().uuid().nullable(),
});

export interface PostMeReferralWithdrawalRequestV1 {
  amountCents: number;
  cardPan: string;
  phone: string;
  bankName: string;
}

export const PostMeReferralWithdrawalRequestV1Schema = z.object({
  amountCents: z.number().int().min(1),
  cardPan: z.string().min(13).max(32),
  phone: z.string().min(10).max(32),
  bankName: z.string().min(1).max(200),
});

export interface PostMeReferralWithdrawalResponseV1 {
  ok: true;
  request: ReferralWithdrawalRequestV1;
}

export const PostMeReferralWithdrawalResponseV1Schema = z.object({
  ok: z.literal(true),
  request: ReferralWithdrawalRequestV1Schema,
});

export interface ListMeReferralWithdrawalsResponseV1 {
  items: ReferralWithdrawalRequestV1[];
}

export const ListMeReferralWithdrawalsResponseV1Schema = z.object({
  items: z.array(ReferralWithdrawalRequestV1Schema),
});

export interface AdminReferralWithdrawalRowV1 {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  amountCents: number;
  cardPan: string;
  phone: string;
  bankName: string;
  status: ReferralWithdrawalStatusV1;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
}

export const AdminReferralWithdrawalRowV1Schema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  amountCents: z.number().int().min(1),
  cardPan: z.string().min(1),
  phone: z.string().min(1),
  bankName: z.string().min(1),
  status: ReferralWithdrawalStatusV1Schema,
  createdAt: z.string(),
  updatedAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedByUserId: z.string().uuid().nullable(),
});

export interface ListAdminReferralWithdrawalsResponseV1 {
  items: AdminReferralWithdrawalRowV1[];
}

export const ListAdminReferralWithdrawalsResponseV1Schema = z.object({
  items: z.array(AdminReferralWithdrawalRowV1Schema),
});

export interface PatchAdminReferralWithdrawalRequestV1 {
  status: 'approved' | 'rejected';
}

export const PatchAdminReferralWithdrawalRequestV1Schema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export interface PatchAdminReferralWithdrawalResponseV1 {
  ok: true;
  request: AdminReferralWithdrawalRowV1;
}

export const PatchAdminReferralWithdrawalResponseV1Schema = z.object({
  ok: z.literal(true),
  request: AdminReferralWithdrawalRowV1Schema,
});
