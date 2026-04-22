import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/fetchJson.js';
import { waitForTelegramInitData } from './telegram.js';
import { getAccessToken, setAccessToken } from './tokenStorage.js';
import { isApiClientError } from '../api/errors.js';

const START_PARAM_POLL_MS = 100;
const START_PARAM_POLL_MAX = 16;

function urlSuggestsLink(): boolean {
  try {
    const s = window.location.search;
    return s.includes('startapp=link_') || s.includes('startapp%3Dlink_');
  } catch {
    return false;
  }
}

function getLinkCodeFromUrl(): string | null {
  try {
    const u = new URL(window.location.href);
    const v = (u.searchParams.get('link') || '').trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

function getStartParam(): string | null {
  try {
    const tg = window.Telegram?.WebApp;
    const p = tg?.initDataUnsafe?.start_param;
    if (typeof p === 'string' && p.trim()) return p.trim();
  } catch {
    /* ignore */
  }
  // Fallback from URL (?startapp=...)
  try {
    const u = new URL(window.location.href);
    const p = u.searchParams.get('startapp');
    if (p && p.trim()) return p.trim();
  } catch {
    /* ignore */
  }
  return null;
}

async function awaitLinkStartParam(): Promise<string | null> {
  let p = getStartParam();
  if (!p && urlSuggestsLink()) {
    for (let i = 0; i < START_PARAM_POLL_MAX && !p; i += 1) {
      await new Promise((r) => setTimeout(r, START_PARAM_POLL_MS));
      p = getStartParam();
    }
  }
  return p;
}

/**
 * Flow:
 * 1) Mini App opened via startapp=link_<code>
 * 2) Claim web access token via POST /auth/site-bridge/claim {code}
 * 3) Call POST /me/telegram/connect with initData under web token
 */
export async function tryFinishTelegramLink(): Promise<void> {
  // Prefer explicit query param (reliable), fallback to Telegram start_param.
  const codeFromUrl = getLinkCodeFromUrl();
  let code = codeFromUrl ?? '';
  if (!code) {
    const startParam = await awaitLinkStartParam();
    if (!startParam || !startParam.startsWith('link_')) return;
    code = startParam.slice('link_'.length).trim();
  }
  if (!code) return;

  const tg = window.Telegram?.WebApp;
  tg?.showAlert?.('Запускаю привязку Telegram к аккаунту на сайте…');
  try {
    const initData = await waitForTelegramInitData();
    if (!initData) {
      tg?.showAlert?.('Не удалось получить данные Telegram. Закройте и откройте мини‑приложение снова.');
      return;
    }

    const raw = await fetchJson<unknown>({
      path: '/auth/site-bridge/claim',
      method: 'POST',
      body: { code },
      headers: {},
    });
    const parsed = ContractsV1.AuthTelegramResponseV1Schema.safeParse(raw);
    if (!parsed.success) {
      tg?.showAlert?.('Не удалось подтвердить привязку. Попробуйте ещё раз из профиля на сайте.');
      return;
    }

    // Temporarily switch token to the claimed web session
    const prev = getAccessToken();
    setAccessToken(parsed.data.accessToken);
    try {
      await fetchJson({
        path: '/me/telegram/connect',
        method: 'POST',
        body: { initData },
      });
      tg?.showAlert?.('Telegram успешно подключён к вашему аккаунту на сайте.');
      tg?.close?.();
    } catch (e) {
      console.warn('telegram connect failed', e);
      if (isApiClientError(e)) {
        tg?.showAlert?.(`Не удалось подключить Telegram: HTTP ${e.status} ${e.code} (${e.requestId})`);
      } else {
        const msg = e instanceof Error ? e.message : 'ошибка сети';
        tg?.showAlert?.(`Не удалось подключить Telegram: ${msg}`);
      }
    } finally {
      // Restore previous token so Mini App stays logged in as Telegram user
      if (prev) setAccessToken(prev);
    }
  } catch (e) {
    console.warn('link flow failed', e);
    if (isApiClientError(e)) {
      tg?.showAlert?.(`Не удалось завершить привязку: HTTP ${e.status} ${e.code} (${e.requestId})`);
    } else {
      const msg = e instanceof Error ? e.message : 'ошибка сети';
      tg?.showAlert?.(`Не удалось завершить привязку: ${msg}`);
    }
  }
}

