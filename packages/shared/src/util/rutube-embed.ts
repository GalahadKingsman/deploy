/**
 * Normalize a Rutube watch or share URL to an embed URL suitable for iframe src.
 * Returns null if the string is not a recognizable Rutube video URL.
 */
export function normalizeRutubeEmbedUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (!u.hostname.endsWith('rutube.ru')) return null;
    const path = u.pathname.replace(/\/$/, '');
    if (path.includes('/play/embed/')) {
      const id = path.split('/play/embed/')[1]?.split('/')[0];
      if (id && /^[a-f0-9-]{20,64}$/i.test(id)) {
        return `https://rutube.ru/play/embed/${id}`;
      }
      return null;
    }
    // Public: /video/<id> ; Private (link-only): /video/private/<id>
    const videoSeg = path.match(/\/video\/(?:private\/)?([a-f0-9-]{20,64})/i);
    if (videoSeg?.[1]) {
      return `https://rutube.ru/play/embed/${videoSeg[1]}`;
    }
    const short = path.match(/\/shorts\/([a-f0-9-]{20,64})/i);
    if (short?.[1]) return `https://rutube.ru/play/embed/${short[1]}`;
  } catch {
    return null;
  }
  return null;
}
