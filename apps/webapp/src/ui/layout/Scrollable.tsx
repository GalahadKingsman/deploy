import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export interface ScrollableProps {
  children: React.ReactNode;
  noTopPadding?: boolean;
  noBottomPadding?: boolean;
}

const SCROLL_STORAGE_LIMIT = 50;
const SCROLL_STORAGE_PREFIX = 'scroll-';
const TAB_PATHS = new Set(['/learn', '/library', '/account']);

/**
 * Cleanup old scroll keys to prevent storage bloat
 * Exported for testing purposes only
 */
export function cleanupOldScrollKeys() {
  try {
    const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(SCROLL_STORAGE_PREFIX));
    if (keys.length > SCROLL_STORAGE_LIMIT) {
      keys.sort();
      const toRemove = keys.slice(0, keys.length - SCROLL_STORAGE_LIMIT);
      toRemove.forEach((key) => sessionStorage.removeItem(key));
    }
  } catch {
    // ignore
  }
}

function saveScrollPosition(key: string, value: number) {
  try {
    // Only save, cleanup is called in pagehide/unmount for performance
    sessionStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

function getScrollPosition(key: string): number | null {
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

export function Scrollable({
  children,
  noTopPadding = false,
  noBottomPadding = false,
}: ScrollableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isRestoringRef = useRef(false);
  const prevScrollKeyRef = useRef<string>('');
  const lastKnownScrollRef = useRef<number>(0);

  // Normalize pathname: remove trailing slashes, ignore query params
  // This ensures /learn and /learn?state=loading use the same scroll key
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const isTab = TAB_PATHS.has(pathname);

  // For tabs: use pathname only (stable key, works with replace: true)
  // Query params are intentionally ignored to maintain scroll position across state changes
  // For other routes: use location.key (unique per navigation entry)
  const scrollKey = isTab
    ? `${SCROLL_STORAGE_PREFIX}${pathname}`
    : `${SCROLL_STORAGE_PREFIX}${location.key || 'default'}`;

  // Save position for previous route when location changes
  // This runs BEFORE the component unmounts, so we can access the actual element
  useLayoutEffect(() => {
    const el = scrollRef.current;

    // If scrollKey changed, save position for previous route
    // This handles both: tab → non-tab and non-tab → tab transitions
    if (prevScrollKeyRef.current && prevScrollKeyRef.current !== scrollKey) {
      const keyToSave = prevScrollKeyRef.current;

      // CRITICAL: Use lastKnownScrollRef which is updated on every scroll event
      // el.scrollTop here might already be 0 if element is being unmounted
      // lastKnownScrollRef is the most reliable source of truth
      const prevScroll = lastKnownScrollRef.current;

      // Update ref AFTER capturing values
      prevScrollKeyRef.current = scrollKey;

      // Always save (including 0) - this is the last chance before unmount
      // Use lastKnownScrollRef which is guaranteed to be up-to-date from scroll events
      saveScrollPosition(keyToSave, prevScroll);
    } else {
      // First render or same route - just update the ref
      // But also ensure lastKnownScrollRef is initialized from element if available
      if (el && lastKnownScrollRef.current === 0) {
        lastKnownScrollRef.current = el.scrollTop || 0;
      }
      prevScrollKeyRef.current = scrollKey;
    }
  }, [scrollKey, location.pathname]);

  // Restore position synchronously before paint
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const saved = getScrollPosition(scrollKey);

    if (saved !== null) {
      // Restore saved position (including 0)
      isRestoringRef.current = true;
      el.scrollTop = saved;
      lastKnownScrollRef.current = saved;
      // Release flag after browser processes scroll
      // Use double RAF to ensure scroll position is applied
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isRestoringRef.current = false;
        });
      });
    } else {
      // No saved position, start at top
      el.scrollTop = 0;
      lastKnownScrollRef.current = 0;
    }
  }, [scrollKey]);

  // Save on scroll + cleanup on pagehide/unmount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initialize lastKnownScrollRef from element's current scroll position
    // This ensures we have a value even if no scroll events have fired yet
    if (lastKnownScrollRef.current === 0 && el.scrollTop > 0) {
      lastKnownScrollRef.current = el.scrollTop;
    }

    const save = () => {
      // Don't save during restore (prevents overwriting saved position)
      if (isRestoringRef.current) return;
      const currentScroll = el.scrollTop;
      // Always update lastKnownScrollRef - this is our source of truth
      lastKnownScrollRef.current = currentScroll;
      try {
        saveScrollPosition(scrollKey, currentScroll);
      } catch {
        // ignore
      }
    };

    const onScroll = () => save();

    // Save before navigation (popstate for back/forward, beforeunload for page close)
    const onPopState = () => {
      // Save current position before browser navigates
      if (!isRestoringRef.current && el) {
        const currentScroll = el.scrollTop || lastKnownScrollRef.current;
        saveScrollPosition(scrollKey, currentScroll);
      }
    };

    // Cleanup on pagehide (before page unload) and unmount
    const onPageHide = () => {
      cleanupOldScrollKeys();
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      // Save on unmount (final save) - always save current position
      // This ensures position is saved even if scrollKey didn't change (for tabs)
      // Also triggers when location.pathname changes (tab → non-tab transition)
      // CRITICAL: scrollKey in closure is the key for THIS component instance
      // (the route being unmounted), so it's correct to use it here
      if (!isRestoringRef.current && el) {
        try {
          // Prefer el.scrollTop (actual current position)
          // Fallback to lastKnownScrollRef (last saved position from scroll events)
          const finalScroll =
            el.scrollTop !== undefined && el.scrollTop !== null
              ? el.scrollTop
              : lastKnownScrollRef.current;
          // Always save (including 0) - user might have scrolled to top intentionally
          saveScrollPosition(scrollKey, finalScroll);
        } catch {
          // ignore
        }
      }
      // Cleanup on unmount (component cleanup)
      cleanupOldScrollKeys();
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [scrollKey, location.pathname]);

  return (
    <div
      ref={scrollRef}
      data-scrollable="true"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingTop: noTopPadding ? 0 : 'var(--safe-top, 0px)',
        paddingBottom: noBottomPadding
          ? 0
          : 'calc(var(--safe-bottom, 0px) + var(--tabs-h, 0px) + var(--spacing-6, 8px))',
        paddingLeft: 'var(--safe-left, 0px)',
        paddingRight: 'var(--safe-right, 0px)',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {children}
    </div>
  );
}
