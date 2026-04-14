import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContractsV1 } from '@tracked/shared';
import { fetchJson, ApiClientError } from '../api/index.js';

export const expertEnrollmentsKey = (expertId: string, courseId: string) =>
  ['experts', expertId, 'courses', courseId, 'enrollments'] as const;

export function useExpertCourseEnrollments(expertId: string, courseId: string) {
  return useQuery<ContractsV1.ListExpertCourseEnrollmentsResponseV1, Error>({
    queryKey: expertEnrollmentsKey(expertId, courseId),
    queryFn: async ({ signal }) => {
      return await fetchJson<ContractsV1.ListExpertCourseEnrollmentsResponseV1>({
        path: `/experts/${encodeURIComponent(expertId)}/courses/${encodeURIComponent(courseId)}/enrollments`,
        signal,
      });
    },
    enabled: Boolean(expertId && courseId),
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) return false;
      return failureCount < 2;
    },
    staleTime: 10_000,
  });
}

export function useExtendEnrollment(expertId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<
    { enrollment: ContractsV1.EnrollmentV1 },
    Error,
    { enrollmentId: string; grantDays: number }
  >({
    mutationFn: async ({ enrollmentId, grantDays }) => {
      return await fetchJson<{ enrollment: ContractsV1.EnrollmentV1 }>({
        path: `/experts/${encodeURIComponent(expertId)}/courses/${encodeURIComponent(courseId)}/enrollments/${encodeURIComponent(enrollmentId)}/extend`,
        method: 'POST',
        body: { grantDays },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: expertEnrollmentsKey(expertId, courseId) });
    },
  });
}

export function useRevokeEnrollment(expertId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<{ enrollment: ContractsV1.EnrollmentV1 }, Error, { enrollmentId: string }>({
    mutationFn: async ({ enrollmentId }) => {
      return await fetchJson<{ enrollment: ContractsV1.EnrollmentV1 }>({
        path: `/experts/${encodeURIComponent(expertId)}/courses/${encodeURIComponent(courseId)}/enrollments/${encodeURIComponent(enrollmentId)}/revoke`,
        method: 'POST',
        body: {},
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: expertEnrollmentsKey(expertId, courseId) });
    },
  });
}

export function useEnrollByTelegram(expertId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<ContractsV1.EnrollmentV1, Error, { telegramUserId: string }>({
    mutationFn: async ({ telegramUserId }) => {
      return await fetchJson<ContractsV1.EnrollmentV1>({
        path: `/experts/${encodeURIComponent(expertId)}/courses/${encodeURIComponent(courseId)}/enroll/by-telegram/${encodeURIComponent(telegramUserId)}`,
        method: 'POST',
        body: {},
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: expertEnrollmentsKey(expertId, courseId) });
    },
  });
}

export function useEnrollByUsername(expertId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation<ContractsV1.EnrollmentV1, Error, { username: string }>({
    mutationFn: async ({ username }) => {
      const clean = username.trim().startsWith('@') ? username.trim().slice(1).trim() : username.trim();
      return await fetchJson<ContractsV1.EnrollmentV1>({
        path: `/experts/${encodeURIComponent(expertId)}/courses/${encodeURIComponent(courseId)}/enroll/by-username/${encodeURIComponent(clean)}`,
        method: 'POST',
        body: {},
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: expertEnrollmentsKey(expertId, courseId) });
    },
  });
}
