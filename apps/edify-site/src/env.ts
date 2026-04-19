/** База URL бэкенда для будущих fetch (логин, каталог и т.д.). Пустая строка — только статика. */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  return typeof v === 'string' ? v.replace(/\/$/, '') : '';
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
