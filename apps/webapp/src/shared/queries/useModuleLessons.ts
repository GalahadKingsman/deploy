import { useQuery } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const moduleLessonsKey = (courseId: string, moduleId: string) =>
  ['courses', courseId, 'modules', moduleId, 'lessons'] as const;

export function useModuleLessons(courseId: string, moduleId: string) {
  return useQuery<ContractsV1.ListModuleLessonsResponseV1, Error>({
    queryKey: moduleLessonsKey(courseId, moduleId),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListModuleLessonsResponseV1>({
        path: `/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}/lessons`,
        signal,
      });
    },
    enabled: Boolean(courseId && moduleId),
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 15_000,
  });
}

