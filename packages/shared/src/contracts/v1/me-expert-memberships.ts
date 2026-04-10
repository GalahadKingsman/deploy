import { z } from 'zod';
import type { ExpertMemberV1 } from './expert-member.js';
import { ExpertMemberV1Schema } from './expert-member.js';

export interface MeExpertMembershipsResponseV1 {
  items: ExpertMemberV1[];
}

export const MeExpertMembershipsResponseV1Schema = z.object({
  items: z.array(ExpertMemberV1Schema),
});

