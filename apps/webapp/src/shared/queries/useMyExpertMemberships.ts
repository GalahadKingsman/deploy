import { useQuery } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const meExpertMemberships = () => ['me', 'expert-memberships'] as const;

export function useMyExpertMemberships() {
  return useQuery<ContractsV1.MeExpertMembershipsResponseV1, Error>({
    queryKey: meExpertMemberships(),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.MeExpertMembershipsResponseV1>({
        path: '/me/expert-memberships',
        signal,
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 30_000,
  });
}

