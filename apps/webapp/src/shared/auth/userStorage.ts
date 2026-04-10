/**
 * User storage for instant display after Telegram auth.
 * Session-scoped so data is fresh when reopening from Telegram.
 */

import type { ContractsV1 } from '@tracked/shared';

const STORAGE_KEY = 'tracked.user.v1';

export function setUser(user: ContractsV1.UserV1): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Failed to store user:', e);
  }
}

export function getUser(): ContractsV1.UserV1 | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || !('id' in parsed) || !('createdAt' in parsed)) {
      return null;
    }
    return parsed as ContractsV1.UserV1;
  } catch {
    return null;
  }
}

export function clearUser(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
