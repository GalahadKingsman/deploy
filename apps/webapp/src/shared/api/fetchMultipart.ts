import { buildUrl } from './url.js';
import { createRequestId, getAuthHeaders } from './headers.js';
import { ApiClientError, mapHttpStatusToErrorCode } from './errors.js';
import { config } from '../config/flags.js';

export async function fetchMultipart<T = unknown>(params: {
  path: string;
  form: FormData;
  signal?: AbortSignal;
}): Promise<T> {
  const requestId = createRequestId();
  const baseUrl = config.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
  if (!baseUrl) {
    throw new ApiClientError(0, 'CONFIG_ERROR', 'VITE_API_BASE_URL is not configured', requestId);
  }
  const url = buildUrl(baseUrl, params.path);
  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-request-id': requestId,
  };
  if (baseUrl.includes('ngrok')) headers['ngrok-skip-browser-warning'] = 'true';
  Object.assign(headers, await getAuthHeaders());

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: params.form,
    signal: params.signal,
  });

  if (res.ok) {
    const ct = res.headers.get('content-type');
    if (ct?.includes('application/json')) return (await res.json()) as T;
    return undefined as T;
  }

  const responseRequestId = res.headers.get('x-request-id') || requestId;
  const code = mapHttpStatusToErrorCode(res.status);
  let message = 'Request failed';
  try {
    const json = await res.json();
    if (json && typeof json === 'object' && 'message' in json && typeof (json as any).message === 'string') {
      message = (json as any).message;
    }
  } catch {
    // ignore
  }
  throw new ApiClientError(res.status, code, message, responseRequestId);
}

