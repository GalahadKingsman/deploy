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

/** Roles allowed when expert owner adds a member via user search (not platform admin). */
export const ExpertTeamInviteRoleV1Schema = z.enum(['manager', 'reviewer', 'support']);

export type ExpertTeamInviteRoleV1 = z.infer<typeof ExpertTeamInviteRoleV1Schema>;

/** Body: POST .../team/members (owner adds member by internal user id + course scope). */
export interface AddExpertTeamMemberByUserRequestV1 {
  userId: string;
  role: ExpertTeamInviteRoleV1;
  /** At least one course required for manager/reviewer/support. */
  courseIds: string[];
}

export const AddExpertTeamMemberByUserRequestV1Schema = z
  .object({
    userId: z.string().uuid(),
    role: ExpertTeamInviteRoleV1Schema,
    courseIds: z.array(z.string().uuid()),
  })
  .refine((d) => d.courseIds.length >= 1, {
    message: 'Select at least one course',
    path: ['courseIds'],
  });

/** Body: PATCH .../team/members/:userId */
export interface UpdateExpertTeamMemberRoleRequestV1 {
  role: ExpertMemberRoleV1;
}

export const UpdateExpertTeamMemberRoleRequestV1Schema = z.object({
  role: ExpertMemberRoleV1Schema,
});
