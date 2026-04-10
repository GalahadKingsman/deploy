import { useMutation, useQuery } from '@tanstack/react-query';
import { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const adminOrdersKey = (filters?: {
  status?: string;
  userId?: string;
  courseId?: string;
  limit?: number;
}) => ['admin', 'payments', 'orders', filters ?? {}] as const;

export function useAdminOrders(filters?: { status?: string; userId?: string; courseId?: string; limit?: number }) {
  return useQuery<{ items: ContractsV1.OrderV1[] }, Error>({
    queryKey: adminOrdersKey(filters),
    queryFn: async ({ signal }) => {
      return await fetchJson<{ items: ContractsV1.OrderV1[] }>({
        path: '/admin/payments/orders',
        query: {
          status: filters?.status,
          userId: filters?.userId,
          courseId: filters?.courseId,
          limit: filters?.limit ?? 50,
        },
        signal,
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 2;
    },
    staleTime: 5_000,
  });
}

export function useAdminMarkOrderPaid() {
  return useMutation<{ ok: true; orderId: string; enrollment: ContractsV1.EnrollmentV1 }, Error, { orderId: string }>({
    mutationFn: async ({ orderId }) => {
      return await fetchJson<{ ok: true; orderId: string; enrollment: ContractsV1.EnrollmentV1 }>({
        path: `/admin/payments/orders/${orderId}/mark-paid`,
        method: 'POST',
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 1;
    },
  });
}

export const adminCommissionsKey = (filters?: { referralCode?: string; limit?: number }) =>
  ['admin', 'payments', 'commissions', filters ?? {}] as const;

export function useAdminCreateRefundRequest() {
  return useMutation<{ item: ContractsV1.PaymentRefundRequestV1 }, Error, { orderId: string; note?: string }>({
    mutationFn: async ({ orderId, note }) => {
      return await fetchJson<{ item: ContractsV1.PaymentRefundRequestV1 }>({
        path: `/admin/payments/orders/${encodeURIComponent(orderId)}/refund-requests`,
        method: 'POST',
        body: note ? { note } : {},
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403 || error.status === 400)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useAdminCommissions(filters?: { referralCode?: string; limit?: number }) {
  return useQuery<
    { items: Array<{ id: string; orderId: string; referralCode: string; amountCents: number; createdAt: string }> },
    Error
  >({
    queryKey: adminCommissionsKey(filters),
    queryFn: async ({ signal }) => {
      return await fetchJson<{
        items: Array<{ id: string; orderId: string; referralCode: string; amountCents: number; createdAt: string }>;
      }>({
        path: '/admin/payments/commissions',
        query: {
          referralCode: filters?.referralCode,
          limit: filters?.limit ?? 50,
        },
        signal,
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 2;
    },
    staleTime: 5_000,
  });
}

