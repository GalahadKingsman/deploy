import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const myReferralStatsKey = () => ['me', 'referral', 'stats'] as const;

export function useMyReferralStats() {
  return useQuery<ContractsV1.MeReferralStatsResponseV1, Error>({
    queryKey: myReferralStatsKey(),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.MeReferralStatsResponseV1>({
        path: '/me/referral/stats',
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

