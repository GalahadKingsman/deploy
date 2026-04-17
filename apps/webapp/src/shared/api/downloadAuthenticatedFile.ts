import { getAuthHeaders } from './headers.js';

/**
 * GET an authenticated API URL that returns a raw file body, then trigger a browser download.
 * Avoids presigned MinIO URLs (not reachable as http://minio:9000 from phones / Safari).
 */
export async function downloadAuthenticatedFile(params: { url: string; fallbackFilename: string }): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(params.url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  let filename = params.fallbackFilename;
  const cd = res.headers.get('content-disposition');
  if (cd) {
    const star = cd.match(/filename\*=UTF-8''([^;\s]+)/i);
    if (star?.[1]) {
      try {
        filename = decodeURIComponent(star[1]);
      } catch {
        filename = params.fallbackFilename;
      }
    } else {
      const quoted = cd.match(/filename="([^"]+)"/i);
      if (quoted?.[1]) filename = quoted[1];
    }
  }

  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}
