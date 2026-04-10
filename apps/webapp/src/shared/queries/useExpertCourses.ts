import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';

export const expertCoursesKey = (expertId: string, params?: { status?: string; q?: string }) =>
  ['experts', expertId, 'courses', params ?? {}] as const;

export function useExpertCourses(expertId: string, params?: { status?: string; q?: string }) {
  return useQuery<ContractsV1.ListExpertCoursesResponseV1, Error>({
    queryKey: expertCoursesKey(expertId, params),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListExpertCoursesResponseV1>({
        path: `/experts/${expertId}/courses`,
        query: { status: params?.status, q: params?.q },
        signal,
      });
    },
    enabled: !!expertId,
  });
}

export function useCreateExpertCourse(expertId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ContractsV1.CreateExpertCourseRequestV1) => {
      return await fetchJson<ContractsV1.ExpertCourseV1>({
        path: `/experts/${expertId}/courses`,
        method: 'POST',
        body,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['experts', expertId, 'courses'] });
    },
  });
}

