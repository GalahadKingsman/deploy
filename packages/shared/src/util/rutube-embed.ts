/**
 * Normalize a Rutube watch or share URL to an embed URL suitable for iframe src.
 * Returns null if the string is not a recognizable Rutube video URL.
 *
 * Private / link-only videos require the access key from the original URL as `?p=...`
 * on the embed URL (see https://rutube.ru/info/embed/). We preserve the full query string
 * from the pasted link so `p` and any other embed params are kept.
 */
const RUTUBE_ID = '[a-z0-9_-]{6,128}';

function embedBaseWithQuery(base: string, source: URL): string {
  const q = source.search;
  return q ? `${base}${q}` : base;
}

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
    const idRe = new RegExp(`^${RUTUBE_ID}$`, 'i');

    if (path.includes('/play/embed/')) {
      const id = path.split('/play/embed/')[1]?.split('/')[0];
      if (id && idRe.test(id)) {
        return embedBaseWithQuery(`https://rutube.ru/play/embed/${id}`, u);
      }
      return null;
    }

    // Legacy: https://rutube.ru/embed/<id>
    const legacyEmbed = path.match(new RegExp(`^/embed/(${RUTUBE_ID})$`, 'i'));
    if (legacyEmbed?.[1] && idRe.test(legacyEmbed[1])) {
      return embedBaseWithQuery(`https://rutube.ru/play/embed/${legacyEmbed[1]}`, u);
    }

    // Live: /live/video/private/<id> or /live/video/<id>
    const liveSeg = path.match(new RegExp(`/live/video/(?:private/)?(${RUTUBE_ID})`, 'i'));
    if (liveSeg?.[1] && idRe.test(liveSeg[1])) {
      return embedBaseWithQuery(`https://rutube.ru/play/embed/${liveSeg[1]}`, u);
    }

    // Public: /video/<id> ; Private (link-only): /video/private/<id> (often with ?p= key)
    const videoSeg = path.match(new RegExp(`/video/(?:private/)?(${RUTUBE_ID})`, 'i'));
    if (videoSeg?.[1] && idRe.test(videoSeg[1])) {
      return embedBaseWithQuery(`https://rutube.ru/play/embed/${videoSeg[1]}`, u);
    }

    const short = path.match(new RegExp(`/shorts/(${RUTUBE_ID})`, 'i'));
    if (short?.[1] && idRe.test(short[1])) {
      return embedBaseWithQuery(`https://rutube.ru/play/embed/${short[1]}`, u);
    }
  } catch {
    return null;
  }
  return null;
}
