import { useQuery } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const meCourses = () => ['me', 'courses'] as const;

export function useMyCourses() {
  return useQuery<ContractsV1.MeCoursesResponseV1, Error>({
    queryKey: meCourses(),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.MeCoursesResponseV1>({
        path: '/me/courses',
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

