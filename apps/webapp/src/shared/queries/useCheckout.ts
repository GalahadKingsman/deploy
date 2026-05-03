import { useMutation } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';
import { getReferral } from '../referrals/referralStorage.js';

export function useCreateExpertSubscriptionCheckout() {
  return useMutation({
    mutationFn: async (params?: { email?: string | null; phone?: string | null }) => {
      const referralCode = getReferral();
      return await fetchJson<ContractsV1.CreateExpertSubscriptionCheckoutResponseV1>({
        path: '/checkout/expert-subscription',
        method: 'POST',
        body: {
          referralCode: referralCode ?? null,
          email: params?.email ?? null,
          phone: params?.phone ?? null,
        } satisfies ContractsV1.CreateExpertSubscriptionCheckoutRequestV1,
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 1;
    },
  });
}
