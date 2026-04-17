import { getAuthHeaders } from './headers.js';

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
 * GET an authenticated API URL that returns a raw file body, then save/share the file.
 * Uses octet-stream blob + Web Share API when available (iOS / Telegram: "Save to Files"),
 * otherwise `<a download>`. Avoids opening PDF/image inline in WebView (breaks "Назад").
 */
export async function downloadAuthenticatedFile(params: { url: string; fallbackFilename: string }): Promise<void> {
  const headers = await getAuthHeaders();
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

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch {
      // cancelled or unsupported — fall through
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
