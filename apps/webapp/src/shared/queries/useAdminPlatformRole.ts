import { useMutation } from '@tanstack/react-query';
import { fetchJson, ApiClientError } from '../api/index.js';

export type PlatformRole = 'user' | 'moderator' | 'admin' | 'owner';

export function useAdminSetUserPlatformRole() {
  return useMutation<{ ok: true }, Error, { userId: string; role: PlatformRole }>({
    mutationFn: async ({ userId, role }) => {
      return await fetchJson<{ ok: true }>({
        path: `/admin/users/${encodeURIComponent(userId)}/platform-role`,
        method: 'POST',
        body: { role },
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 404)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

