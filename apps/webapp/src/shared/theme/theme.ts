export type ThemeId = 'light' | 'dark';

const STORAGE_KEY = 'edify.theme.v1';

export function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'dark';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function persistTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function applyThemeToDocument(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function syncTelegramChromeColors(theme: ThemeId): void {
  if (typeof window === 'undefined') return;
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  const bg = theme === 'light' ? '#f4f6f9' : '#000000';
  try {
    tg.setHeaderColor?.(bg);
    tg.setBackgroundColor?.(bg);
  } catch {
    /* ignore */
  }
}
