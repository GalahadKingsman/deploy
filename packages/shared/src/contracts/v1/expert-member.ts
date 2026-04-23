import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

/**
 * Expert member role V1
 */
export type ExpertMemberRoleV1 = 'owner' | 'manager' | 'reviewer' | 'support';

/**
 * Zod schema for ExpertMemberRoleV1
 */
export const ExpertMemberRoleV1Schema = z.enum(['owner', 'manager', 'reviewer', 'support']);

/**
 * Expert member entity V1
 */
export interface ExpertMemberV1 {
  expertId: Id;
  userId: Id;
  role: ExpertMemberRoleV1;
  createdAt: IsoDateTime;
  /** `experts.created_by_user_id === userId` — владелец кабинета/пространства. Заполняется в /me/expert-memberships. */
  isWorkspaceCreator?: boolean;
}

/**
 * Zod schema for ExpertMemberV1
 */
export const ExpertMemberV1Schema = z.object({
  expertId: z.string().uuid(),
  userId: z.string().uuid(),
  role: ExpertMemberRoleV1Schema,
  createdAt: z.string(),
  isWorkspaceCreator: z.boolean().optional(),
});
