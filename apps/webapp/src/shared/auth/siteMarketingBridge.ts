import { ContractsV1 } from '@tracked/shared';
import { fetchJson } from '../api/fetchJson.js';
import { config } from '../config/flags.js';
import { hasSiteMarketingLoginIntent } from './telegram.js';
import type { BootstrapAuthResult } from './bootstrapAuth.js';

const START_PARAM_POLL_MS = 100;
const START_PARAM_POLL_MAX = 16;

type MainButtonApi = {
  setText?: (text: string) => void;
  show?: () => void;
  hide?: () => void;
  onClick?: (cb: () => void) => void;
  offClick?: (cb: () => void) => void;
};

function urlSuggestsSiteLogin(): boolean {
  try {
    const s = window.location.search;
    return s.includes('startapp=site') || s.includes('startapp%3Dsite');
  } catch {
    return false;
  }
}

async function awaitSiteLoginIntent(): Promise<boolean> {
  let intent = hasSiteMarketingLoginIntent();
  if (!intent && urlSuggestsSiteLogin()) {
    for (let i = 0; i < START_PARAM_POLL_MAX && !intent; i += 1) {
      await new Promise((r) => setTimeout(r, START_PARAM_POLL_MS));
      intent = hasSiteMarketingLoginIntent();
    }
  }
  return intent;
}

async function issueBridgeUrl(): Promise<string | null> {
  const raw = await fetchJson<unknown>({
    path: '/auth/site-bridge/issue',
    method: 'POST',
    body: {},
  });
  const parsed = ContractsV1.AuthSiteBridgeIssueResponseV1Schema.safeParse(raw);
  if (!parsed.success) {
    console.warn('site-bridge issue: unexpected response', raw);
    return null;
  }
  const base = config.MARKETING_SITE_URL;
  return `${base}/?login=${encodeURIComponent(parsed.data.code)}`;
}

function openMarketingLoginUrl(url: string, tg: NonNullable<typeof window.Telegram>['WebApp']): void {
  try {
    void navigator.clipboard.writeText(url);
  } catch {
    /* ignore */
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened == null) {
    if (tg.openLink) tg.openLink(url, { try_instant_view: false });
    else window.location.assign(url);
  }
}

/**
 * После входа в Mini App с `startapp=site`: выдаём код и открываем маркетинг.
 * Если есть MainButton — ждём нажатия (жест пользователя → `window.open` не блокируется).
 * Иначе — сразу `openLink` как раньше.
 */
export async function tryFinishSiteMarketingLogin(
  authResult: BootstrapAuthResult | null,
): Promise<void> {
  if (!authResult || authResult.mode !== 'authenticated') return;
  if (!(await awaitSiteLoginIntent())) return;

  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  if (!tg) return;

  const mb = tg.MainButton as MainButtonApi | undefined;
  const canUseMainButton =
    typeof mb?.onClick === 'function' &&
    typeof mb?.show === 'function' &&
    typeof mb?.setText === 'function' &&
    typeof mb?.hide === 'function';

  const runIssueAndOpen = async () => {
    try {
      const url = await issueBridgeUrl();
      if (!url) {
        tg.showAlert?.('Не удалось получить код для входа на сайт. Попробуйте снова из бота.');
        return;
      }
      openMarketingLoginUrl(url, tg);
    } catch (e) {
      console.warn('site-bridge issue failed:', e);
      const msg = e instanceof Error ? e.message : 'ошибка сети';
      tg.showAlert?.(`Вход на сайт: ${msg}`);
    }
  };

  if (canUseMainButton) {
    mb.setText!('Открыть сайт EDIFY для входа');
    mb.show!();
    let finished = false;
    const handler = () => {
      if (finished) return;
      finished = true;
      mb.offClick?.(handler);
      mb.hide!();
      void runIssueAndOpen();
    };
    mb.onClick!(handler);
    return;
  }

  try {
    const url = await issueBridgeUrl();
    if (!url) {
      tg.showAlert?.('Не удалось получить код для входа на сайт. Попробуйте снова из бота.');
      return;
    }
    if (tg.openLink) tg.openLink(url, { try_instant_view: false });
    else window.location.assign(url);
  } catch (e) {
    console.warn('site-bridge issue failed:', e);
    const msg = e instanceof Error ? e.message : 'ошибка сети';
    tg.showAlert?.(`Вход на сайт: ${msg}`);
  }
}
