/** База URL бэкенда (claim /me). Сначала Vite env, затем `<meta name="edify-api-base" content="https://api…">` на сервере. */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '');
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="edify-api-base"]')?.getAttribute('content');
    if (typeof m === 'string' && m.trim()) return m.trim().replace(/\/$/, '');
  }
  return '';
}

/** Имя бота без @ для ссылки t.me/...?start=site */
export function getTelegramBotUsername(): string {
  const v = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
  if (typeof v === 'string' && v.trim()) return v.trim().replace(/^@/, '');
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="edify-telegram-bot"]')?.getAttribute('content');
    if (typeof m === 'string' && m.trim()) return m.trim().replace(/^@/, '');
  }
  return '';
}

/** Ссылка на бота в режиме «поддержка»: t.me/<bot>?start=support; пустая, если бот не настроен. */
export function getTelegramSupportUrl(): string {
  const bot = getTelegramBotUsername();
  if (!bot) return '';
  return `https://t.me/${bot}?start=support`;
}

/**
 * Базовый URL веб-приложения / мини-аппа, где в `main.tsx` сохраняется `?ref=` (реферальная ссылка).
 * Переопределение: `VITE_REFERRAL_APP_BASE_URL` или `<meta name="edify-referral-app-base" content="https://…">`.
 */
/**
 * Лендинг: выключить кнопку оплаты явно — `VITE_PAYMENTS_ENABLED=0` / `false`.
 * Если переменная не задана при сборке, считаем оплату доступной (проверка на API).
 */
export function isLandingPaymentsUiEnabled(): boolean {
  try {
    const v = import.meta.env.VITE_PAYMENTS_ENABLED as string | boolean | undefined;
    if (v === undefined || v === '') return true;
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase().trim();
    if (s === '0' || s === 'false' || s === 'no') return false;
    return true;
  } catch {
    return true;
  }
}

export function getReferralAppBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_REFERRAL_APP_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '');
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="edify-referral-app-base"]')?.getAttribute('content');
    if (typeof m === 'string' && m.trim()) return m.trim().replace(/\/$/, '');
  }
  return 'https://app.edify.su';
}
