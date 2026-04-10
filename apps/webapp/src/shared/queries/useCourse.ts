import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';
import { course } from './queryKeys.js';

/**
 * Hook to fetch course by ID
 * GET /courses/:id
 */
export function useCourse(courseId: string) {
  return useQuery<ContractsV1.GetCourseResponseV1, Error>({
    queryKey: course(courseId),
    queryFn: async ({ signal }) => {
      return fetchJson<ContractsV1.GetCourseResponseV1>({
        path: `/courses/${courseId}`,
        signal,
      });
    },
    enabled: !!courseId,
  });
}
