import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson, getHttpStatus } from '../api/index.js';
import { meExpertSubscription } from './queryKeys.js';

/**
 * Hook to fetch current user's expert subscription (Story 5.4).
 * Best-effort: 404 or any error (401/500/network) → return null (NONE / student).
 * GET /me/expert-subscription — real API in 5.5; until then read path may be unavailable.
 * MSW: ?expertCta=none|expired|active for dev UX (e.g. /account?expertCta=active).
 */
export function useMyExpertSubscription(options?: { expertCta?: 'none' | 'expired' | 'active' }) {
  const expertCta = options?.expertCta;

  return useQuery<ContractsV1.ExpertSubscriptionV1 | null, Error>({
    queryKey: [...meExpertSubscription(), expertCta],
    queryFn: async ({ signal }) => {
      try {
        return await fetchJson<ContractsV1.ExpertSubscriptionV1>({
          path: '/me/expert-subscription',
          query: expertCta ? { expertCta } : undefined,
          signal,
        });
      } catch (error) {
        const status = getHttpStatus(error);
        if (import.meta.env.DEV) {
          console.warn('[useMyExpertSubscription] best-effort: error → NONE', status, error);
        }
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
