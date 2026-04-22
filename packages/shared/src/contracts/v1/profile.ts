import { z } from 'zod';
import { UserV1Schema } from './user.js';

export interface UpdateMyProfileRequestV1 {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export const UpdateMyProfileRequestV1Schema = z.object({
  firstName: z.string().min(1).max(80).nullable().optional(),
  lastName: z.string().min(1).max(80).nullable().optional(),
  email: z.string().email().max(320).nullable().optional(),
});

export interface UpdateMyProfileResponseV1 {
  user: z.infer<typeof UserV1Schema>;
}

export const UpdateMyProfileResponseV1Schema = z.object({
  user: UserV1Schema,
});

