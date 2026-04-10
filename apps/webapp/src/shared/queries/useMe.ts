import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';
import { getUser } from '../auth/userStorage.js';
import { me } from './queryKeys.js';

/**
 * Hook to fetch current user
 * GET /me
 * Uses user from sessionStorage (saved after POST /auth/telegram) as initialData so name/avatar show immediately in Mini App.
 */
export function useMe() {
  return useQuery<ContractsV1.GetMeResponseV1, Error>({
    queryKey: me(),
    queryFn: async ({ signal }) => {
      return fetchJson<ContractsV1.GetMeResponseV1>({
        path: '/me',
        signal,
      });
    },
    initialData: () => {
      const user = getUser();
      return user ? { user } : undefined;
    },
    retry: (failureCount, error) => {
      // Don't retry on 401 (unauthorized)
      if (error instanceof ApiClientError && error.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 10 * 60 * 1000, // 10 min — не помечаем как устаревшие при переходах
    gcTime: 30 * 60 * 1000, // 30 min — держим в кэше полчаса
    refetchOnMount: false, // не перезапрашивать при возврате на страницу
    placeholderData: keepPreviousData, // при refetch показывать старые данные
  });
}
