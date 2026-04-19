import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/fetchJson.js';
import { config } from '../config/flags.js';
import { getTelegramStartParam } from './telegram.js';
import type { BootstrapAuthResult } from './bootstrapAuth.js';

/**
 * После входа в Mini App по ссылке с бота (?start=site → startapp=site) выдаём одноразовый код
 * и открываем маркетинговый сайт с ?login=…, где токен сохраняется в localStorage.
 */
export async function tryFinishSiteMarketingLogin(
  authResult: BootstrapAuthResult | null,
): Promise<void> {
  if (!authResult || authResult.mode !== 'authenticated') return;
  if (getTelegramStartParam() !== 'site') return;

  const base = config.MARKETING_SITE_URL;
  try {
    const raw = await fetchJson<unknown>({
      path: '/auth/site-bridge/issue',
      method: 'POST',
      body: {},
    });
    const parsed = ContractsV1.AuthSiteBridgeIssueResponseV1Schema.safeParse(raw);
    if (!parsed.success) {
      console.warn('site-bridge issue: unexpected response');
      return;
    }
    const url = `${base}/?login=${encodeURIComponent(parsed.data.code)}`;
    window.Telegram?.WebApp?.openLink?.(url);
  } catch (e) {
    console.warn('site-bridge issue failed:', e);
  }
}
