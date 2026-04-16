import { useQuery } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const courseModulesKey = (courseId: string) => ['courses', courseId, 'modules'] as const;

export function useCourseModules(courseId: string) {
  return useQuery<ContractsV1.ListExpertCourseModulesResponseV1, Error>({
    queryKey: courseModulesKey(courseId),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListExpertCourseModulesResponseV1>({
        path: `/courses/${encodeURIComponent(courseId)}/modules`,
        signal,
      });
    },
    enabled: Boolean(courseId),
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 30_000,
  });
}

