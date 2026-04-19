import { getApiBaseUrl } from './env.js';
import { setAccessToken } from './authSession.js';

/**
 * Обмен `?login=` на JWT (тот же ключ, что в webapp) и очистка query в адресной строке.
 */
function stripLoginQuery(): void {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has('login')) return;
    u.searchParams.delete('login');
    window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
  } catch {
    /* ignore */
  }
}

export async function claimSiteLoginFromUrl(): Promise<void> {
  let code: string | null = null;
  try {
    code = new URL(window.location.href).searchParams.get('login');
  } catch {
    return;
  }
  if (!code?.trim()) return;

  const api = getApiBaseUrl();
  if (!api) {
    stripLoginQuery();
    window.alert(
      'Не задан адрес API: в сборке укажите VITE_API_BASE_URL или в HTML добавьте <meta name="edify-api-base" content="https://api.edify.su">. Иначе вход с сайта не завершится.',
    );
    return;
  }

  try {
    const res = await fetch(`${api}/auth/site-bridge/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    });
    if (!res.ok) {
      stripLoginQuery();
      window.alert(
        res.status === 403
          ? 'Доступ запрещён (например, аккаунт заблокирован).'
          : 'Не удалось завершить вход. Проверьте CORS на API для домена сайта и что код не истёк.',
      );
      return;
    }
    const data = (await res.json()) as { accessToken?: string };
    if (typeof data.accessToken === 'string' && data.accessToken.length > 0) {
      setAccessToken(data.accessToken);
    }
  } catch {
    stripLoginQuery();
    window.alert(
      'Сеть: не удалось связаться с API. Проверьте адрес API, HTTPS и CORS (должен быть разрешён origin https://edify.su).',
    );
    return;
  }

  stripLoginQuery();
}
