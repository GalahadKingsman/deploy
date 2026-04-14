import { useMutation } from '@tanstack/react-query';
import { fetchJson, ApiClientError } from '../api/index.js';

export type ExpertMemberRole = 'owner' | 'manager' | 'reviewer' | 'support';

export function useAdminCreateExpert() {
  return useMutation<{ id: string }, Error, { title: string; ownerUserId: string; slug?: string }>({
    mutationFn: async ({ title, ownerUserId, slug }) => {
      return await fetchJson<{ id: string }>({
        path: '/admin/experts',
        method: 'POST',
        body: {
          title,
          ownerUserId,
          slug: slug && slug.trim() ? slug.trim() : undefined,
        },
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

export function useAdminAddExpertMember() {
  return useMutation<
    { ok: true },
    Error,
    { expertId: string; userId: string; role: ExpertMemberRole }
  >({
    mutationFn: async ({ expertId, userId, role }) => {
      return await fetchJson<{ ok: true }>({
        path: `/admin/experts/${encodeURIComponent(expertId.trim())}/members`,
        method: 'POST',
        body: { userId, role },
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 409)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useAdminSetExpertMemberRole() {
  return useMutation<
    { ok: true },
    Error,
    { expertId: string; userId: string; role: ExpertMemberRole }
  >({
    mutationFn: async ({ expertId, userId, role }) => {
      return await fetchJson<{ ok: true }>({
        path: `/admin/experts/${encodeURIComponent(expertId.trim())}/members/${encodeURIComponent(userId)}`,
        method: 'PATCH',
        body: { role },
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 404)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useAdminRemoveExpertMember() {
  return useMutation<{ ok: true }, Error, { expertId: string; userId: string }>({
    mutationFn: async ({ expertId, userId }) => {
      return await fetchJson<{ ok: true }>({
        path: `/admin/experts/${encodeURIComponent(expertId.trim())}/members/${encodeURIComponent(userId)}`,
        method: 'DELETE',
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403 || error.status === 404)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useAdminGrantExpertSubscriptionDays() {
  return useMutation<
    unknown,
    Error,
    { expertId: string; days: number }
  >({
    mutationFn: async ({ expertId, days }) => {
      return await fetchJson({
        path: `/admin/experts/${encodeURIComponent(expertId.trim())}/subscription/grant-days`,
        method: 'POST',
        body: { days },
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 404)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

export function useAdminExpireExpertSubscriptionNow() {
  return useMutation<unknown, Error, { expertId: string }>({
    mutationFn: async ({ expertId }) => {
      return await fetchJson({
        path: `/admin/experts/${encodeURIComponent(expertId.trim())}/subscription/expire`,
        method: 'POST',
      });
    },
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && (error.status === 401 || error.status === 403 || error.status === 404)) {
        return false;
      }
      return failureCount < 1;
    },
  });
}

