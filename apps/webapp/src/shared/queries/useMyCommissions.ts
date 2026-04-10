import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const myCommissionsKey = () => ['me', 'commissions'] as const;

export function useMyCommissions() {
  return useQuery<ContractsV1.MeCommissionsResponseV1, Error>({
    queryKey: myCommissionsKey(),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.MeCommissionsResponseV1>({
        path: '/me/commissions',
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

