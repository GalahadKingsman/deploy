import type { ContractsV1 } from '@tracked/shared';

type ExpertMemberRoleV1 = ContractsV1.ExpertMemberRoleV1;

/** Role rank: owner > manager > reviewer > support */
const ROLE_RANK: Record<ExpertMemberRoleV1, number> = {
  owner: 3,
  manager: 2,
  reviewer: 1,
  support: 0,
};

/**
 * Check if user's expert role meets or exceeds required role
 */
export function isExpertRoleAllowed(
  userRole: ExpertMemberRoleV1,
  requiredRole: ExpertMemberRoleV1,
): boolean {
  const userRank = ROLE_RANK[userRole] ?? -1;
  const requiredRank = ROLE_RANK[requiredRole] ?? 0;
  return userRank >= requiredRank;
}
