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

/** Старый домен приложения в реф-ссылке → всегда маркетинговый лендинг. */
function normalizeReferralMarketingBase(base: string): string {
  const trimmed = base.trim().replace(/\/$/, '');
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (host === 'app.edify.su') return 'https://edify.su';
  } catch {
    /* ignore invalid URL */
  }
  return trimmed;
}

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

/**
 * Базовый URL для реферальной ссылки `?ref=` (обработка на edify.su).
 * Приоритет: `VITE_REFERRAL_APP_BASE_URL` → meta `edify-referral-app-base` → `window.location.origin` → `https://edify.su`.
 * Значения с хостом `app.edify.su` (в т.ч. из старой сборки в env) переписываются на `https://edify.su`.
 */
export function getReferralAppBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_REFERRAL_APP_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return normalizeReferralMarketingBase(fromEnv.trim().replace(/\/$/, ''));
  }
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="edify-referral-app-base"]')?.getAttribute('content');
    if (typeof m === 'string' && m.trim()) {
      return normalizeReferralMarketingBase(m.trim().replace(/\/$/, ''));
    }
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const h = window.location.hostname;
    // Кабинет на app.* — реферал всё равно должен открывать маркетинговый сайт, где обрабатывается ?ref=.
    if (h === 'app.edify.su') return 'https://edify.su';
    if (window.location.origin) {
      return normalizeReferralMarketingBase(window.location.origin.replace(/\/$/, ''));
    }
  }
  return 'https://edify.su';
}

/**
 * Публичный сайт (браузер, не Mini App): инвайт `…/invite/<код>`, лендинг, `/platform/`.
 * Переопределение: `VITE_STUDENT_WEB_BASE_URL` или `<meta name="edify-student-web-base" content="https://edify.su">`.
 * По умолчанию — origin страницы в браузере, иначе `https://edify.su`.
 */
export function getStudentWebBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_STUDENT_WEB_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '');
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="edify-student-web-base"]')?.getAttribute('content');
    if (typeof m === 'string' && m.trim()) return m.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'https://edify.su';
}
