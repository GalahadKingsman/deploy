import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';
import { lesson } from './queryKeys.js';

/**
 * Hook to fetch lesson by ID
 * GET /lessons/:id
 */
export function useLesson(lessonId: string) {
  return useQuery<ContractsV1.GetLessonResponseV1, Error>({
    queryKey: lesson(lessonId),
    queryFn: async ({ signal }) => {
      return fetchJson<ContractsV1.GetLessonResponseV1>({
        path: `/lessons/${lessonId}`,
        signal,
      });
    },
    enabled: !!lessonId,
  });
}
