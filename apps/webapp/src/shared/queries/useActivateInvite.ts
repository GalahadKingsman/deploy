import { useMutation } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/index.js';
import { getReferral } from '../referrals/referralStorage.js';

export function useActivateInvite() {
  return useMutation({
    mutationFn: async (code: string) => {
      const referralCode = getReferral();
      return await fetchJson<ContractsV1.ActivateInviteResponseV1>({
        path: '/invites/activate',
        method: 'POST',
        body: {
          code,
          referralCode: referralCode ?? null,
        } satisfies ContractsV1.ActivateInviteRequestV1,
      });
    },
  });
}

