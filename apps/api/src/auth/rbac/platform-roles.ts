import type { ContractsV1 } from '@tracked/shared';

type PlatformRoleV1 = ContractsV1.PlatformRoleV1;

const ROLE_RANK: Record<PlatformRoleV1, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
  owner: 3,
};

/**
 * Check if user's role meets or exceeds required role
 */
export function isRoleAllowed(userRole: PlatformRoleV1, requiredRole: PlatformRoleV1): boolean {
  const userRank = ROLE_RANK[userRole] ?? -1;
  const requiredRank = ROLE_RANK[requiredRole] ?? 0;
  return userRank >= requiredRank;
}
