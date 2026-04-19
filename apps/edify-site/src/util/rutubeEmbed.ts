/**
 * Same behavior as @tracked/shared `normalizeRutubeEmbedUrl`.
 * Kept locally so the marketing site bundle does not depend on the workspace package graph.
 *
 * @see packages/shared/src/util/rutube-embed.ts
 */
const RUTUBE_ID = '[a-z0-9_-]{6,128}';

function embedBaseWithQuery(base: string, source: URL): string {
  const q = source.search;
  return q ? `${base}${q}` : base;
}

function sanitizeRutubePaste(raw: string): string {
  let s = raw
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  if (!s) return s;
  const embedded = s.match(/https?:\/\/(?:www\.)?rutube\.ru\/[^\s]+/i);
  if (embedded) s = embedded[0].replace(/[),.;]+$/, '');
  return s.trim();
}

export function normalizeRutubeEmbedUrl(raw: string): string | null {
  let s = sanitizeRutubePaste(raw);
  if (!s) return null;
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

    const legacyEmbed = path.match(new RegExp(`^/embed/(${RUTUBE_ID})$`, 'i'));
    if (legacyEmbed?.[1] && idRe.test(legacyEmbed[1])) {
      return embedBaseWithQuery(`https://rutube.ru/play/embed/${legacyEmbed[1]}`, u);
    }

    const liveSeg = path.match(new RegExp(`/live/video/(?:private/)?(${RUTUBE_ID})`, 'i'));
    if (liveSeg?.[1] && idRe.test(liveSeg[1])) {
      return embedBaseWithQuery(`https://rutube.ru/play/embed/${liveSeg[1]}`, u);
    }

    const privateWatch = path.match(new RegExp(`^/video/private/(${RUTUBE_ID})(?:/|$)`, 'i'));
    if (privateWatch?.[1] && idRe.test(privateWatch[1])) {
      return embedBaseWithQuery(`https://rutube.ru/play/embed/${privateWatch[1]}`, u);
    }
    const publicWatch = path.match(new RegExp(`^/video/(${RUTUBE_ID})(?:/|$)`, 'i'));
    if (publicWatch?.[1] && idRe.test(publicWatch[1])) {
      return embedBaseWithQuery(`https://rutube.ru/play/embed/${publicWatch[1]}`, u);
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
