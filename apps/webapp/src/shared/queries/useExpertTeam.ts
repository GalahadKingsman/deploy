import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const expertTeamKey = (expertId: string) => ['expert', expertId, 'team'] as const;

export function useExpertTeam(expertId: string) {
  return useQuery<ContractsV1.ListExpertTeamResponseV1, Error>({
    queryKey: expertTeamKey(expertId),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListExpertTeamResponseV1>({
        path: `/experts/${encodeURIComponent(expertId)}/team/members`,
        signal,
      });
    },
    enabled: Boolean(expertId),
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 2;
    },
    staleTime: 15_000,
  });
}
