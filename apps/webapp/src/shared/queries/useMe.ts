import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';
import { getUser, setUser } from '../auth/userStorage.js';
import { me } from './queryKeys.js';

/**
 * Hook to fetch current user
 * GET /me
 * Имя из sessionStorage (после POST /auth/telegram) — placeholder; /me всегда запрашиваем,
 * чтобы подтянуть avatar_url с S3 (синк на бэке) и не залипать на null 10 минут.
 */
export function useMe() {
  return useQuery<ContractsV1.GetMeResponseV1, Error>({
    queryKey: me(),
    queryFn: async ({ signal }) => {
      const data = await fetchJson<ContractsV1.GetMeResponseV1>({
        path: '/me',
        signal,
      });
      if (data.user) setUser(data.user);
      return data;
    },
    placeholderData: (previousData) => {
      if (previousData) return previousData;
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
    staleTime: 60_000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
  });
}
