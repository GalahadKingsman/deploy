import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const myOrdersKey = () => ['me', 'orders'] as const;

export function useMyOrders() {
  return useQuery<ContractsV1.MeOrdersResponseV1, Error>({
    queryKey: myOrdersKey(),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.MeOrdersResponseV1>({
        path: '/me/orders',
        signal,
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data as ContractsV1.MeOrdersResponseV1 | undefined;
      const hasPending = (data?.items ?? []).some((o) => o.status === 'created');
      return hasPending ? 3_000 : false;
    },
  });
}

