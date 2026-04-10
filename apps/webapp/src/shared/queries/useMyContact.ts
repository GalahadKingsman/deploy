import { useMutation, useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const myContactKey = () => ['me', 'contact'] as const;

export function useMyContact() {
  return useQuery<ContractsV1.GetMyContactResponseV1, Error>({
    queryKey: myContactKey(),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.GetMyContactResponseV1>({
        path: '/me/contact',
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

export function useUpdateMyContact() {
  return useMutation<ContractsV1.UpdateMyContactResponseV1, Error, ContractsV1.UpdateMyContactRequestV1>({
    mutationFn: async (body) => {
      return await fetchJson<ContractsV1.UpdateMyContactResponseV1>({
        path: '/me/contact',
        method: 'PATCH',
        body,
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.status === 401) return false;
      return failureCount < 1;
    },
  });
}

