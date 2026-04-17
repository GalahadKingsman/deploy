import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';

const expertLessonSubmissionsKey = (expertId: string, lessonId: string) =>
  ['expert', expertId, 'lessons', lessonId, 'submissions'] as const;

export function useExpertLessonSubmissions(expertId: string, lessonId: string) {
  return useQuery<ContractsV1.ListLessonSubmissionsResponseV1, Error>({
    queryKey: expertLessonSubmissionsKey(expertId, lessonId),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListLessonSubmissionsResponseV1>({
        path: `/experts/${expertId}/lessons/${lessonId}/submissions`,
        signal,
      });
    },
    enabled: !!expertId && !!lessonId,
  });
}

export function useDecideSubmission(expertId: string, lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      submissionId: string;
      status: ContractsV1.SubmissionStatusV1;
      score?: number | null;
      reviewerComment?: string | null;
    }) => {
      return await fetchJson<ContractsV1.CreateSubmissionResponseV1>({
        path: `/experts/${expertId}/lessons/${lessonId}/submissions/${params.submissionId}`,
        method: 'PATCH',
        body: {
          status: params.status,
          ...(params.score !== undefined ? { score: params.score } : {}),
          ...(params.reviewerComment !== undefined ? { reviewerComment: params.reviewerComment } : {}),
        } satisfies ContractsV1.DecideSubmissionRequestV1,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: expertLessonSubmissionsKey(expertId, lessonId) });
    },
  });
}

