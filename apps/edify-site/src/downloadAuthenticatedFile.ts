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
