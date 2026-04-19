import { getApiBaseUrl } from './env.js';
import { setAccessToken } from './authSession.js';

/**
 * Обмен `?login=` на JWT (тот же ключ, что в webapp) и очистка query в адресной строке.
 */
export async function claimSiteLoginFromUrl(): Promise<void> {
  const api = getApiBaseUrl();
  if (!api) return;

  let code: string | null = null;
  try {
    code = new URL(window.location.href).searchParams.get('login');
  } catch {
    return;
  }
  if (!code?.trim()) return;

  try {
    const res = await fetch(`${api}/auth/site-bridge/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { accessToken?: string };
    if (typeof data.accessToken === 'string' && data.accessToken.length > 0) {
      setAccessToken(data.accessToken);
    }
  } catch {
    // ignore
  }

  try {
    const u = new URL(window.location.href);
    u.searchParams.delete('login');
    const next = `${u.pathname}${u.search}${u.hash}`;
    window.history.replaceState({}, '', next);
  } catch {
    // ignore
  }
}
