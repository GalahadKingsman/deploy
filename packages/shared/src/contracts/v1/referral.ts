import { z } from 'zod';

export interface GetMyReferralResponseV1 {
  code: string;
}

export const GetMyReferralResponseV1Schema = z.object({
  code: z.string().min(1).max(64),
});

