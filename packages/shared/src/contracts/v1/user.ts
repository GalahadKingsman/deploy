import { z } from 'zod';
import type { Id, IsoDateTime, UrlString } from './common.js';
import { PlatformRoleV1Schema } from './platform-role.js';

/**
 * User entity V1
 */
export interface UserV1 {
  id: Id;
  telegramUserId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: UrlString | null;
  platformRole: import('./platform-role.js').PlatformRoleV1;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * Zod schema for UserV1
 */
export const UserV1Schema = z.object({
  id: z.string(),
  telegramUserId: z.string().optional(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
  platformRole: PlatformRoleV1Schema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
