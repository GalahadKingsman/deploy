import { SetMetadata } from '@nestjs/common';
import type { ContractsV1 } from '@tracked/shared';

type PlatformRoleV1 = ContractsV1.PlatformRoleV1;

export const REQUIRE_PLATFORM_ROLE_KEY = 'requirePlatformRole';

/**
 * Require minimum platform role for the route
 */
export const RequirePlatformRole = (role: PlatformRoleV1) =>
  SetMetadata(REQUIRE_PLATFORM_ROLE_KEY, role);
