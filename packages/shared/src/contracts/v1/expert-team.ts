import { z } from 'zod';
import type { ExpertMemberRoleV1 } from './expert-member.js';
import { ExpertMemberRoleV1Schema } from './expert-member.js';

export interface ExpertTeamMemberV1 {
  userId: string;
  role: ExpertMemberRoleV1;
  createdAt: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Email from user profile (may be null). */
  email: string | null;
  /** Human-readable course scope, e.g. «Все курсы» or «2 курса». */
  coursesLabel: string;
  /** ISO timestamp proxy for last activity (users.updated_at). */
  lastActivityAt: string | null;
}

export interface ListExpertTeamResponseV1 {
  items: ExpertTeamMemberV1[];
  /** Expert account creator (from `experts.created_by_user_id`); for UI: «владелец» / add team button. */
  createdByUserId: string;
}

export const ExpertTeamMemberV1Schema = z.object({
  userId: z.string(),
  role: ExpertMemberRoleV1Schema,
  createdAt: z.string(),
  username: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  coursesLabel: z.string(),
  lastActivityAt: z.string().nullable(),
});

export const ListExpertTeamResponseV1Schema = z.object({
  items: z.array(ExpertTeamMemberV1Schema),
  createdByUserId: z.string().uuid(),
});
