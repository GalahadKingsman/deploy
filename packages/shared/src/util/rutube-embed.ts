/**
 * Normalize a Rutube watch or share URL to an embed URL suitable for iframe src.
 * Returns null if the string is not a recognizable Rutube video URL.
 */
export function normalizeRutubeEmbedUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // Accept scheme-less URLs pasted from mobile (e.g. "rutube.ru/video/..." or "//rutube.ru/video/...").
  if (s.startsWith('//')) s = `https:${s}`;
  if (/^(?:www\.)?rutube\.ru\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname.endsWith('rutube.ru')) return null;
    const path = u.pathname.replace(/\/$/, '');
    // Rutube IDs can be hex-like, but also other safe chars depending on link type.
    // Keep this permissive; server-side access is enforced by Rutube itself.
    const idRe = /([a-z0-9_-]{10,128})/i;
    if (path.includes('/play/embed/')) {
      const id = path.split('/play/embed/')[1]?.split('/')[0];
      if (id && idRe.test(id)) {
        return `https://rutube.ru/play/embed/${id}`;
      }
      return null;
    }
    // Public: /video/<id> ; Private (link-only): /video/private/<id>
    const videoSeg = path.match(/\/video\/(?:private\/)?([a-z0-9_-]{10,128})/i);
    if (videoSeg?.[1]) {
      return `https://rutube.ru/play/embed/${videoSeg[1]}`;
    }
    const short = path.match(/\/shorts\/([a-z0-9_-]{10,128})/i);
    if (short?.[1]) return `https://rutube.ru/play/embed/${short[1]}`;
  } catch {
    return null;
  }
  return null;
}
