/**
 * Telegram WebApp utilities
 */

/**
 * User-like object for display only (from API UserV1 or from initDataUnsafe.user)
 */
export interface TelegramDisplayUser {
  firstName?: string;
  lastName?: string;
  username?: string;
  avatarUrl?: string | null;
  /** Telegram user id (only when opened in Telegram). For display + copy in Account. */
  telegramId?: string;
}

/**
 * Telegram WebApp type definition
 */
interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
  version?: string;
  platform?: string;
  colorScheme?: 'light' | 'dark';
  themeParams?: unknown;
  isExpanded?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  headerColor?: string;
  backgroundColor?: string;
  BackButton?: unknown;
  MainButton?: unknown;
  HapticFeedback?: unknown;
  CloudStorage?: unknown;
  BiometricManager?: unknown;
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  onEvent?: (eventType: string, eventHandler: () => void) => void;
  offEvent?: (eventType: string, eventHandler: () => void) => void;
  sendData?: (data: string) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  openInvoice?: (url: string, callback?: (status: string) => void) => void;
  showPopup?: (params: unknown, callback?: (id: string) => void) => void;
  showAlert?: (message: string, callback?: () => void) => void;
  showConfirm?: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup?: (params: unknown, callback?: (data: string) => void) => void;
  closeScanQrPopup?: () => void;
  readTextFromClipboard?: (callback?: (text: string) => void) => void;
  requestWriteAccess?: (callback?: (granted: boolean) => void) => void;
  requestContact?: (callback?: (granted: boolean) => void) => void;
}

interface Telegram {
  WebApp?: TelegramWebApp;
}

declare global {
  interface Window {
    Telegram?: Telegram;
  }
}

/** Open external HTTPS URL (payment redirect). Uses `Telegram.WebApp.openLink` inside Mini App when available. */
export function openExternalHttpsUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) {
    tg.openLink(url, { try_instant_view: false });
    return;
  }
  window.location.assign(url);
}

/**
 * Get Telegram initData safely
 * @returns initData string or null if not in Telegram or initData unavailable
 */
export function getTelegramInitData(): string | null {
  try {
    // Check if we're in Telegram WebApp environment
    if (typeof window === 'undefined') {
      return null;
    }

    const telegram = window.Telegram;
    if (!telegram?.WebApp) {
      return null;
    }

    const initData = telegram.WebApp.initData;
    if (!initData || typeof initData !== 'string' || initData.trim().length === 0) {
      return null;
    }

    return initData;
  } catch {
    // Silently fail if Telegram API is not available
    return null;
  }
}

/**
 * Wait for window.Telegram.WebApp to be available (Telegram client may inject it async).
 * Calls WebApp.ready() when available so Telegram finalizes initData (v0.3.4.3 / v0.4.4).
 * @param maxMs - Max time to wait in ms
 * @returns true if Telegram.WebApp is present, false on timeout
 */
export function waitForTelegramWebApp(maxMs: number = 2500): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (window.Telegram?.WebApp) {
        try {
          window.Telegram.WebApp.ready?.();
        } catch {
          // ignore
        }
        resolve(true);
        return;
      }
      if (Date.now() - start >= maxMs) {
        resolve(false);
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

/**
 * Get display-only user from Telegram initDataUnsafe (when initData string or API /me not available).
 * Use for greeting/avatar so the user sees their name even before auth completes.
 */
export function getTelegramDisplayUser(): TelegramDisplayUser | null {
  try {
    if (typeof window === 'undefined') return null;
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u || typeof u !== 'object') return null;
    return {
      firstName: u.first_name,
      lastName: u.last_name,
      username: u.username,
      avatarUrl: u.photo_url ?? null,
      telegramId: u.id != null ? String(u.id) : undefined,
    };
  } catch {
    return null;
  }
}

const INIT_DATA_RETRY_MS = 200;
const INIT_DATA_RETRIES = 15;

/**
 * Wait for initData to appear (Telegram may set it asynchronously after WebApp object exists).
 * Call after waitForTelegramWebApp.
 * @returns initData string or null if not available after retries
 */
export function waitForTelegramInitData(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let attempt = 0;
    const check = () => {
      const data = getTelegramInitData();
      if (data) {
        resolve(data);
        return;
      }
      attempt += 1;
      if (attempt >= INIT_DATA_RETRIES) {
        resolve(null);
        return;
      }
      setTimeout(check, INIT_DATA_RETRY_MS);
    };
    check();
  });
}
