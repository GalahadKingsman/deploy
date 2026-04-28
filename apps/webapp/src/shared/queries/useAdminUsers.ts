import { useQuery } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export type AdminUserPick = Pick<
  ContractsV1.UserV1,
  'id' | 'telegramUserId' | 'username' | 'firstName' | 'lastName' | 'platformRole' | 'createdAt' | 'updatedAt'
> & {
  /** Same heuristic as GET /me/expert-subscription; omitted on older APIs. */
  activeExpertId?: string | null;
};

export const adminUsersKey = (params?: { q?: string; limit?: number; offset?: number }) =>
  ['admin', 'users', params?.q ?? '', params?.limit ?? 50, params?.offset ?? 0] as const;

export function useAdminUsers(params?: { q?: string; limit?: number; offset?: number }) {
  return useQuery<{ items: AdminUserPick[] }, Error>({
    queryKey: adminUsersKey(params),
    queryFn: async ({ signal }) => {
      return await fetchJson<{ items: AdminUserPick[] }>({
        path: '/admin/users',
        query: {
          q: params?.q,
          limit: params?.limit ?? 50,
          offset: params?.offset ?? 0,
        },
        signal,
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 1;
    },
    staleTime: 5_000,
  });
}

