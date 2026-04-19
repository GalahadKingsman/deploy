import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/fetchJson.js';
import { config } from '../config/flags.js';
import { hasSiteMarketingLoginIntent } from './telegram.js';
import type { BootstrapAuthResult } from './bootstrapAuth.js';

const START_PARAM_POLL_MS = 100;
const START_PARAM_POLL_MAX = 16;

function urlSuggestsSiteLogin(): boolean {
  try {
    const s = window.location.search;
    return s.includes('startapp=site') || s.includes('startapp%3Dsite');
  } catch {
    return false;
  }
}

/**
 * После входа в Mini App по ссылке с бота (?start=site → startapp=site) выдаём одноразовый код
 * и открываем маркетинговый сайт с ?login=…, где токен сохраняется в localStorage.
 */
export async function tryFinishSiteMarketingLogin(
  authResult: BootstrapAuthResult | null,
): Promise<void> {
  if (!authResult || authResult.mode !== 'authenticated') return;

  let intent = hasSiteMarketingLoginIntent();
  if (!intent && urlSuggestsSiteLogin()) {
    for (let i = 0; i < START_PARAM_POLL_MAX && !intent; i += 1) {
      await new Promise((r) => setTimeout(r, START_PARAM_POLL_MS));
      intent = hasSiteMarketingLoginIntent();
    }
  }
  if (!intent) return;

  const base = config.MARKETING_SITE_URL;
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  try {
    const raw = await fetchJson<unknown>({
      path: '/auth/site-bridge/issue',
      method: 'POST',
      body: {},
    });
    const parsed = ContractsV1.AuthSiteBridgeIssueResponseV1Schema.safeParse(raw);
    if (!parsed.success) {
      console.warn('site-bridge issue: unexpected response', raw);
      tg?.showAlert?.('Не удалось получить код для входа на сайт. Попробуйте снова из бота.');
      return;
    }
    const url = `${base}/?login=${encodeURIComponent(parsed.data.code)}`;
    if (tg?.openLink) {
      tg.openLink(url, { try_instant_view: false });
    } else {
      window.location.assign(url);
    }
  } catch (e) {
    console.warn('site-bridge issue failed:', e);
    const msg = e instanceof Error ? e.message : 'ошибка сети';
    tg?.showAlert?.(`Вход на сайт: ${msg}`);
  }
}
