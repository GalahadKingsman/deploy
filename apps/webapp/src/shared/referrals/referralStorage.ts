const KEY = 'tracked.referral.v1';

export function setReferral(code: string): void {
  const v = code.trim();
  if (!v) return;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // ignore
  }
}

export function getReferral(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

