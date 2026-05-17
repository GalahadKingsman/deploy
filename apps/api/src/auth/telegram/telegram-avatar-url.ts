/** Ссылки t.me/i/userpic не открываются в браузере как <img src> (hotlink). */
export function isTelegramUserpicCdnUrl(url: string | null | undefined): boolean {
  const raw = typeof url === 'string' ? url.trim() : '';
  return /^https?:\/\/t\.me\/i\/userpic\//i.test(raw);
}

/** Не сохраняем userpic в БД — аватар подтягиваем в S3 через Bot API на GET /me. */
export function sanitizeAvatarUrlForStorage(url: string | null | undefined): string | null {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return null;
  if (isTelegramUserpicCdnUrl(raw)) return null;
  return raw;
}
