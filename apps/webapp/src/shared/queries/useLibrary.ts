import { useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';
import { library } from './queryKeys.js';

/**
 * Hook to fetch library (courses and recommended)
 * GET /library
 */
export function useLibrary(params?: { limit?: number; offset?: number }) {
  return useQuery<ContractsV1.GetLibraryResponseV1, Error>({
    queryKey: library(params),
    queryFn: async ({ signal }) => {
      return fetchJson<ContractsV1.GetLibraryResponseV1>({
        path: '/library',
        query: params,
        signal,
      });
    },
  });
}
