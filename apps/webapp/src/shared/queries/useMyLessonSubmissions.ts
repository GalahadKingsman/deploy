import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';

export const myLessonSubmissionsKey = (lessonId: string) => ['lessons', lessonId, 'submissions', 'me'] as const;

export function useMyLessonSubmissions(lessonId: string) {
  return useQuery<ContractsV1.ListLessonSubmissionsResponseV1, Error>({
    queryKey: myLessonSubmissionsKey(lessonId),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListLessonSubmissionsResponseV1>({
        path: `/lessons/${lessonId}/submissions/me`,
        signal,
      });
    },
    enabled: !!lessonId,
  });
}

