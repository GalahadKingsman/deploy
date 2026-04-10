import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson, getHttpStatus } from '../api/index.js';
import { meExpertApplication } from './queryKeys.js';

const MOCK_APP_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000002';
const NOW = new Date().toISOString();

function mockApplication(
  status: 'pending' | 'rejected' | 'approved',
): ContractsV1.ExpertApplicationV1 {
  return {
    id: MOCK_APP_ID,
    userId: MOCK_USER_ID,
    status,
    note: status === 'rejected' ? 'Previous note' : null,
    adminNote: status === 'rejected' ? 'Not enough experience' : null,
    createdAt: NOW,
    updatedAt: NOW,
    decidedAt: status !== 'pending' ? NOW : null,
    decidedByUserId: status !== 'pending' ? MOCK_USER_ID : null,
  };
}

/**
 * Hook for current user's expert application (Story 5.6).
 * GET /me/expert-application; on any error → application: null (UI does not break).
 * DEV override: ?expertApp=none|pending|rejected|approved to force state without API.
 */
export function useMyExpertApplication(options?: {
  expertApp?: 'none' | 'pending' | 'rejected' | 'approved';
}) {
  const expertApp = options?.expertApp;
  const queryClient = useQueryClient();

  const query = useQuery<ContractsV1.MeExpertApplicationResponseV1, Error>({
    queryKey: [...meExpertApplication(), expertApp],
    queryFn: async ({ signal }) => {
      if (import.meta.env.DEV && expertApp != null) {
        if (expertApp === 'none') {
          return { application: null };
        }
        return { application: mockApplication(expertApp) };
      }
      try {
        return await fetchJson<ContractsV1.MeExpertApplicationResponseV1>({
          path: '/me/expert-application',
          query: expertApp ? { expertApp } : undefined,
          signal,
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn(
            '[useMyExpertApplication] best-effort: error → null',
            getHttpStatus(error),
            error,
          );
        }
        return { application: null };
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: async (note?: string) => {
      return await fetchJson<ContractsV1.MeExpertApplicationResponseV1>({
        path: '/me/expert-application',
        method: 'POST',
        body: note != null && note !== '' ? { note: note.trim() } : {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meExpertApplication() });
    },
  });

  return {
    data: query.data ?? { application: null },
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    submit: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}
