import { getApiBaseUrl } from './env.js';

const STORAGE_KEY = 'edify.referral.v1';
const SESSION_GREETED_KEY = 'edify.referral.greeted.v1';

const REF_PARAM_NAMES = ['ref', 'referral', 'referralCode'] as const;

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Read `?ref=` (or `?referral=` / `?referralCode=`) from the current URL, persist into localStorage. */
export function captureReferralFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    for (const param of REF_PARAM_NAMES) {
      const v = url.searchParams.get(param);
      if (v && v.trim()) {
        const code = v.trim().slice(0, 64);
        const ls = safeLocalStorage();
        if (ls) ls.setItem(STORAGE_KEY, code);
        return code;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Stored referral code (set previously via captureReferralFromUrl). */
export function getStoredReferralCode(): string | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const v = ls.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Forget the referral code (e.g. on explicit user logout). Currently unused but useful for QA. */
export function clearStoredReferralCode(): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Resolve a referral code into a public display name + avatar (no email/phone). */
export async function fetchReferralPreview(code: string): Promise<{
  displayName: string | null;
  avatarUrl: string | null;
}> {
  const api = getApiBaseUrl();
  if (!api.trim()) return { displayName: null, avatarUrl: null };
  const url = `${api}/public/referral/preview?code=${encodeURIComponent(code)}`;
  try {
    const res = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
    if (!res.ok) return { displayName: null, avatarUrl: null };
    const data = (await res.json()) as { displayName?: string | null; avatarUrl?: string | null };
    return {
      displayName:
        typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : null,
      avatarUrl: typeof data.avatarUrl === 'string' && data.avatarUrl.trim() ? data.avatarUrl.trim() : null,
    };
  } catch {
    return { displayName: null, avatarUrl: null };
  }
}

/** Per-tab guard so refreshing the landing does not re-show the welcome modal. */
export function hasGreetedReferralThisSession(): boolean {
  const ss = safeSessionStorage();
  if (!ss) return false;
  try {
    return ss.getItem(SESSION_GREETED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markGreetedReferralThisSession(): void {
  const ss = safeSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(SESSION_GREETED_KEY, '1');
  } catch {
    /* ignore */
  }
}
