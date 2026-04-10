import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const topicsKey = () => ['topics'] as const;
export const courseTopicsKey = (expertId: string, courseId: string) =>
  ['experts', expertId, 'courses', courseId, 'topics'] as const;

export function useTopics() {
  return useQuery<ContractsV1.ListTopicsResponseV1, Error>({
    queryKey: topicsKey(),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListTopicsResponseV1>({ path: '/topics', signal });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 60_000,
  });
}

export function useCourseTopics(expertId: string, courseId: string) {
  return useQuery<ContractsV1.ListCourseTopicsResponseV1, Error>({
    queryKey: courseTopicsKey(expertId, courseId),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListCourseTopicsResponseV1>({
        path: `/experts/${encodeURIComponent(expertId)}/courses/${encodeURIComponent(courseId)}/topics`,
        signal,
      });
    },
    enabled: Boolean(expertId && courseId),
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 2;
    },
    staleTime: 15_000,
  });
}

export function useSetCourseTopics(expertId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<ContractsV1.ListCourseTopicsResponseV1, Error, { topicIds: string[] }>({
    mutationFn: async (body) => {
      return await fetchJson<ContractsV1.ListCourseTopicsResponseV1>({
        path: `/experts/${encodeURIComponent(expertId)}/courses/${encodeURIComponent(courseId)}/topics`,
        method: 'PUT',
        body,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: courseTopicsKey(expertId, courseId) });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 1;
    },
  });
}
