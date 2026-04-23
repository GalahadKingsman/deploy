import type { FastifyRequest } from 'fastify';

/**
 * Публичный base API для ссылок в JSON (img src), чтобы не полагаться на `getApiBaseUrl()` в браузере.
 * Приоритет: `API_PUBLIC_BASE_URL` → X-Forwarded-* / Host.
 */
export function getPublicApiBaseFromRequest(req: FastifyRequest): string {
  const fromEnv = (process.env.API_PUBLIC_BASE_URL ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const h =
    (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ||
    (req.headers['host'] as string | undefined)?.split(',')[0]?.trim() ||
    '';
  if (!h) return '';

  const p = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() || '';
  if (p === 'http' || p === 'https') {
    return `${p}://${h}`.replace(/\/$/, '');
  }
  if (h.startsWith('127.0.0.1') || h.startsWith('localhost')) {
    return `http://${h}`.replace(/\/$/, '');
  }
  return `https://${h}`.replace(/\/$/, '');
}

/**
 * Абсолютный URL для `<img src>` из `users.avatar_url` (как в edify-site `getAvatarImageSrc`).
 */
export function resolveUserAvatarToAbsoluteForBrowser(
  stored: string | null,
  publicApiBase: string,
): string | null {
  if (stored == null) return null;
  const a = String(stored).trim();
  if (!a) return null;
  if (a.startsWith('https://') || a.startsWith('http://')) {
    return a;
  }
  const b = publicApiBase.replace(/\/$/, '');
  if (!b) {
    return a;
  }
  if (a.startsWith('/')) {
    return `${b}${a}`;
  }
  if (a.startsWith('avatars/')) {
    return `${b}/public/avatar?key=${encodeURIComponent(a)}`;
  }
  return a;
}
