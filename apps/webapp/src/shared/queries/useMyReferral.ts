import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const myReferralKey = () => ['me', 'referral'] as const;

export function useMyReferral() {
  return useQuery<ContractsV1.GetMyReferralResponseV1, Error>({
    queryKey: myReferralKey(),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.GetMyReferralResponseV1>({
        path: '/me/referral',
        signal,
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 10 * 60 * 1000,
  });
}

