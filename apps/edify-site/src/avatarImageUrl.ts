import { getApiBaseUrl } from './env.js';

/** Parse key from what we store in `users.avatar_url` or legacy shapes. */
function extractAvatarKey(stored: string): string {
  const v = (stored || '').trim();
  if (!v) return '';
  if (v.startsWith('submissions/') || v.startsWith('avatars/')) return v;
  if (v.startsWith('/public/avatar?')) {
    try {
      return (new URL(v, 'https://x.local').searchParams.get('key') || '').trim();
    } catch {
      return '';
    }
  }
  if (v.startsWith('/files?')) {
    try {
      return (new URL(v, 'https://x.local').searchParams.get('key') || '').trim();
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Public URL for `<img src>`. `POST /me/avatar` stores `/public/avatar?key=...` (no JWT).
 * Prefer this over `/files/signed` for display — signed endpoint required DB for all keys before a fix.
 */
export function getAvatarImageSrc(avatarUrl: string | null | undefined): string {
  if (avatarUrl == null) return '';
  const raw = String(avatarUrl).trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  const key = extractAvatarKey(raw);
  const api = getApiBaseUrl();
  if (key.startsWith('avatars/')) {
    if (api) return `${api}/public/avatar?key=${encodeURIComponent(key)}`;
    // Без VITE_API_BASE_URL и пустой meta: относительный /public/avatar уйдёт на origin сайта, а не API.
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const h = window.location.hostname;
      if (h === 'edify.su' || h.endsWith('.edify.su')) {
        return `https://api.edify.su/public/avatar?key=${encodeURIComponent(key)}`;
      }
    }
    return `/public/avatar?key=${encodeURIComponent(key)}`;
  }
  if (raw.startsWith('/')) {
    if (api) return `${api.replace(/\/$/, '')}${raw}`;
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const h = window.location.hostname;
      if (h === 'edify.su' || h.endsWith('.edify.su')) {
        return `https://api.edify.su${raw}`;
      }
    }
    return raw;
  }
  return raw;
}
