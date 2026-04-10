import { z } from 'zod';

export interface MeContactV1 {
  email?: string | null;
  phone?: string | null;
}

export const MeContactV1Schema = z.object({
  email: z.string().email().nullable().optional(),
  phone: z.string().min(5).max(32).nullable().optional(),
});

export interface GetMyContactResponseV1 {
  contact: MeContactV1;
}

export const GetMyContactResponseV1Schema = z.object({
  contact: MeContactV1Schema,
});

export interface UpdateMyContactRequestV1 {
  email?: string | null;
  phone?: string | null;
}

export const UpdateMyContactRequestV1Schema = MeContactV1Schema;

export interface UpdateMyContactResponseV1 {
  contact: MeContactV1;
}

export const UpdateMyContactResponseV1Schema = z.object({
  contact: MeContactV1Schema,
});

