import { webappEnv } from '../env/env.js';

function resolveApiOrigin(): string {
  const api = (webappEnv.VITE_API_BASE_URL ?? '').trim();
  return api ? api.replace(/\/$/, '') : '';
}

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
  return '';
}

export function isBrokenTelegramUserpicUrl(url: string | null | undefined): boolean {
  const raw = typeof url === 'string' ? url.trim() : '';
  return /^https?:\/\/t\.me\/i\/userpic\//i.test(raw);
}

export function getAvatarImageSrc(avatarUrl: string | null | undefined): string {
  if (avatarUrl == null) return '';
  const raw = String(avatarUrl).trim();
  if (!raw) return '';
  if (isBrokenTelegramUserpicUrl(raw)) return '';

  const key = extractAvatarKey(raw);
  const api = resolveApiOrigin();
  if (key.startsWith('avatars/')) {
    if (api) return `${api}/public/avatar?key=${encodeURIComponent(key)}`;
    return `/public/avatar?key=${encodeURIComponent(key)}`;
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) {
    if (api) return `${api}${raw}`;
    return raw;
  }
  return raw;
}
