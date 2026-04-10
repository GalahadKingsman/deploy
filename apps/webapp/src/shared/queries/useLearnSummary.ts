import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';
import { learnSummary } from './queryKeys.js';

/**
 * Hook to fetch learn summary (active course and next lesson)
 * GET /learn/summary
 */
export function useLearnSummary() {
  return useQuery<ContractsV1.GetLearnSummaryResponseV1, Error>({
    queryKey: learnSummary(),
    queryFn: async ({ signal }) => {
      return fetchJson<ContractsV1.GetLearnSummaryResponseV1>({
        path: '/learn/summary',
        signal,
      });
    },
  });
}
