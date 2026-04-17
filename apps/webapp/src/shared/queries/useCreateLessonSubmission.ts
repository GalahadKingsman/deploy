import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';
import { lessonSubmissions } from './queryKeys.js';
import { myLessonSubmissionsKey } from './useMyLessonSubmissions.js';

export function useCreateLessonSubmission(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ContractsV1.CreateSubmissionRequestV1) => {
      return await fetchJson<ContractsV1.CreateSubmissionResponseV1>({
        path: `/lessons/${lessonId}/submissions`,
        method: 'POST',
        body,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: lessonSubmissions(lessonId) });
      await qc.invalidateQueries({ queryKey: myLessonSubmissionsKey(lessonId) });
    },
  });
}

