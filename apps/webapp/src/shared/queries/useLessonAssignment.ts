import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';
import { lessonAssignment } from './queryKeys.js';

export function useLessonAssignment(lessonId: string) {
  return useQuery<ContractsV1.GetLessonAssignmentResponseV1, Error>({
    queryKey: lessonAssignment(lessonId),
    queryFn: async ({ signal }) => {
      return fetchJson<ContractsV1.GetLessonAssignmentResponseV1>({
        path: `/lessons/${lessonId}/assignment`,
        signal,
      });
    },
    enabled: !!lessonId,
  });
}

