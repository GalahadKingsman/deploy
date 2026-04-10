import { z } from 'zod';

/**
 * Platform role V1
 */
export type PlatformRoleV1 = 'user' | 'moderator' | 'admin' | 'owner';

/**
 * Zod schema for PlatformRoleV1
 */
export const PlatformRoleV1Schema = z.enum(['user', 'moderator', 'admin', 'owner']);
