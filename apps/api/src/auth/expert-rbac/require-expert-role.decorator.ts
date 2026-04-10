import { SetMetadata } from '@nestjs/common';
import type { ContractsV1 } from '@tracked/shared';

type ExpertMemberRoleV1 = ContractsV1.ExpertMemberRoleV1;

export const REQUIRE_EXPERT_ROLE_KEY = 'requireExpertRole';

/**
 * Require minimum expert role for the route (expert tenancy)
 */
export const RequireExpertRole = (role: ExpertMemberRoleV1) =>
  SetMetadata(REQUIRE_EXPERT_ROLE_KEY, role);
