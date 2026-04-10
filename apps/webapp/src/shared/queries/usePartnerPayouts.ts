import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const myPayoutRequestsKey = () => ['me', 'payout-requests'] as const;

export function useMyPayoutRequests() {
  return useQuery<ContractsV1.ListMyPayoutRequestsResponseV1, Error>({
    queryKey: myPayoutRequestsKey(),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListMyPayoutRequestsResponseV1>({
        path: '/me/payout-requests',
        signal,
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 10_000,
  });
}

export function useCreatePayoutRequest() {
  const qc = useQueryClient();
  return useMutation<{ item: ContractsV1.PartnerPayoutRequestV1 }, Error, { amountCents: number }>({
    mutationFn: async (body) => {
      return await fetchJson<{ item: ContractsV1.PartnerPayoutRequestV1 }>({
        path: '/me/payout-requests',
        method: 'POST',
        body,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: myPayoutRequestsKey() });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 400)) return false;
      return failureCount < 1;
    },
  });
}
