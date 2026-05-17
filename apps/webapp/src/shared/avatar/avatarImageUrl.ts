import { config } from '../config/flags.js';

/** Как fetchJson: env → meta → api.edify.su на *.edify.su → origin (прокси на app.*). */
function resolveApiOrigin(): string {
  const fromEnv = (config.API_BASE_URL ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="edify-api-base"]')?.getAttribute('content');
    if (typeof m === 'string' && m.trim()) return m.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const h = window.location.hostname.toLowerCase();
    if (h === 'edify.su' || h.endsWith('.edify.su')) {
      return 'https://api.edify.su';
    }
    const origin = window.location.origin?.replace(/\/$/, '');
    if (origin) return origin;
  }
  return '';
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
