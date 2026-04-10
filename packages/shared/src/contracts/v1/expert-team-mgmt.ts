import { z } from 'zod';
import type { ExpertMemberRoleV1 } from './expert-member.js';
import { ExpertMemberRoleV1Schema } from './expert-member.js';

/** Body: POST .../team/members/by-telegram/:telegramUserId */
export interface AddExpertTeamMemberRequestV1 {
  role: ExpertMemberRoleV1;
}

export const AddExpertTeamMemberRequestV1Schema = z.object({
  role: ExpertMemberRoleV1Schema,
});

/** Body: PATCH .../team/members/:userId */
export interface UpdateExpertTeamMemberRoleRequestV1 {
  role: ExpertMemberRoleV1;
}

export const UpdateExpertTeamMemberRoleRequestV1Schema = z.object({
  role: ExpertMemberRoleV1Schema,
});
