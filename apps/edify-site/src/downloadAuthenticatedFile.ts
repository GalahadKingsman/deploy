import { getAccessToken } from './authSession.js';

function parseFilenameFromContentDisposition(cd: string | null, fallback: string): string {
  if (!cd) return fallback;
  const star = cd.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return fallback;
    }
  }
  const quoted = cd.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  return fallback;
}

/**
 * GET an authenticated API URL that returns a raw file body (same pattern as Telegram webapp).
 */
export async function downloadAuthenticatedFile(params: { url: string; fallbackFilename: string }): Promise<void> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(params.url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const filename = parseFilenameFromContentDisposition(
    res.headers.get('content-disposition'),
    params.fallbackFilename,
  );

  const ab = await res.arrayBuffer();
  const forcedBlob = new Blob([ab], { type: 'application/octet-stream' });
  const file = new File([forcedBlob], filename, { type: 'application/octet-stream' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch {
      /* cancelled or unsupported */
    }
  }

  const objUrl = URL.createObjectURL(forcedBlob);
  try {
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objUrl), 120_000);
  }
}

/**
 * Fetch file with auth (e.g. `.../download?inline=1`) and open in a new tab for preview.
 */
export async function previewAuthenticatedFile(params: { url: string }): Promise<void> {
  const token = getAccessToken();
  const headers: Record<string, string> = { accept: '*/*' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(params.url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const rawCt = res.headers.get('content-type');
  const ct = (rawCt?.split(';')[0] ?? '').trim() || 'application/octet-stream';
  const ab = await res.arrayBuffer();
  const blob = new Blob([ab], { type: ct });
  const objUrl = URL.createObjectURL(blob);
  const opened = window.open(objUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(objUrl);
    window.alert('Не удалось открыть вкладку. Разрешите всплывающие окна для этого сайта.');
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(objUrl), 600_000);
}
