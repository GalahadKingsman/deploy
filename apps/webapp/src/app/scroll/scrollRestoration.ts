const SCROLL_STORAGE_LIMIT = 50;
const TAB_PREFIX = 'tab:';
const LOC_PREFIX = 'loc:';

const TAB_PATHS = new Set(['/library', '/learn', '/account']);

/**
 * Check if pathname is a tab route
 */
export function isTabPath(pathname: string): boolean {
  return TAB_PATHS.has(pathname);
}

/**
 * Get tab key for a pathname
 */
export function getTabKey(pathname: string): string {
  return `${TAB_PREFIX}${pathname}`;
}

/**
 * Get location key for scroll storage
 */
export function getLocKey(locationKey: string): string {
  return `${LOC_PREFIX}${locationKey}`;
}

/**
 * Save scroll position
 */
export function saveScroll(key: string, value: number): void {
  try {
    sessionStorage.setItem(key, String(value));
    cleanupOldScrollKeys();
  } catch {
    // ignore storage errors
  }
}

/**
 * Load scroll position
 */
export function loadScroll(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n;
  } catch {
    return null;
  }
}

/**
 * Cleanup old location keys (loc:*) to prevent storage bloat
 * Keeps only the most recent 50 keys
 */
export function cleanupOldScrollKeys(): void {
  try {
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(LOC_PREFIX));
    if (keys.length > SCROLL_STORAGE_LIMIT) {
      // Sort by key (FIFO - oldest first)
      keys.sort();
      const toRemove = keys.slice(0, keys.length - SCROLL_STORAGE_LIMIT);
      toRemove.forEach((key) => sessionStorage.removeItem(key));
    }
  } catch {
    // ignore storage errors
  }
}
