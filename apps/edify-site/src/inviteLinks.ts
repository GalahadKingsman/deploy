import { getReferralAppBaseUrl, getTelegramBotUsername } from './env.js';

/** Deep link: открыть бота с payload inv_<code>. */
export function buildInviteTelegramStartUrl(code: string): string | null {
  const bot = getTelegramBotUsername();
  if (!bot) return null;
  return `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(`inv_${code}`)}`;
}

/** Webapp: POST /invites/activate после входа. */
export function buildInviteWebActivateUrl(code: string): string {
  return `${getReferralAppBaseUrl()}/invite/${encodeURIComponent(code)}`;
}

/** Что копируем: основная ссылка зачисления (сайт / Mini App). */
export function resolveInviteCopyUrl(code: string): string {
  return buildInviteWebActivateUrl(code);
}
