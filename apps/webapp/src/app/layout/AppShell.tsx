import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { BottomTabs } from '../../ui/shell/BottomTabs.js';
import {
  isTabPath,
  getTabKey,
  getLocKey,
  saveScroll,
  loadScroll,
} from '../scroll/scrollRestoration.js';

export function AppShell() {
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const isRestoringRef = useRef(false);
  const lastScrollRef = useRef<number>(0);
  const prevPathnameRef = useRef<string>('');

  const pathname = location.pathname;
  const isTab = isTabPath(pathname);
  const prevIsTab = isTabPath(prevPathnameRef.current);

  const setTelegramVerticalSwipe = (enabled: boolean) => {
    try {
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined;
      if (!tg) return;

      // Preferred (tma.js-like) API: tg.swipeBehavior.enableVertical/disableVertical
      const sb = tg.swipeBehavior as any;
      if (sb) {
        if (enabled && typeof sb.enableVertical === 'function') {
          sb.enableVertical();
          return;
        }
        if (!enabled && typeof sb.disableVertical === 'function') {
          sb.disableVertical();
          return;
        }
      }

      // Fallback: some clients may expose enableVertical/disableVertical directly on tg.WebApp
      if (enabled && typeof tg.enableVertical === 'function') {
        tg.enableVertical();
        return;
      }
      if (!enabled && typeof tg.disableVertical === 'function') {
        tg.disableVertical();
        return;
      }
    } catch {
      // ignore
    }
  };

  // Telegram Mini App: disable swipe-down-to-close everywhere.
  // Users can close/minimize only via Telegram UI (arrow-down / close button).
  useEffect(() => {
    setTelegramVerticalSwipe(false);
  }, [pathname]);

  // Telegram Mini App: replace "Close" with native Back button on nested pages
  useEffect(() => {
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
    const bb = tg?.BackButton;
    if (!bb?.show || !bb?.hide || !bb?.onClick) return;

    const shouldShow = !isTab;
    const handle = () => {
      // If opened directly (no history), go to learn instead of doing nothing.
      if (typeof window !== 'undefined' && window.history.length <= 1) {
        navigate('/learn', { replace: true });
        return;
      }
      navigate(-1);
    };

    if (shouldShow) bb.show();
    else bb.hide();
    bb.onClick(handle);

    return () => {
      try {
        bb.offClick?.(handle);
      } catch {
        // ignore
      }
    };
  }, [isTab, navigate]);

  // Save scroll position on scroll events
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (isRestoringRef.current) return;
      const scrollTop = el.scrollTop;
      lastScrollRef.current = scrollTop;

      // Determine key to save
      if (isTab) {
        const tabKey = getTabKey(pathname);
        saveScroll(tabKey, scrollTop);
      } else {
        const locKey = getLocKey(location.key);
        saveScroll(locKey, scrollTop);
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, [pathname, location.key, isTab]);

  // Save position before navigation (but not during restore)
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el || isRestoringRef.current) {
      prevPathnameRef.current = pathname;
      return;
    }

    const scrollTop = el.scrollTop || lastScrollRef.current;

    // If leaving a tab to go to detail, save tab position
    if (prevIsTab && !isTab && prevPathnameRef.current) {
      const tabKey = getTabKey(prevPathnameRef.current);
      saveScroll(tabKey, scrollTop);
    }

    // Save current position
    if (isTab) {
      const tabKey = getTabKey(pathname);
      saveScroll(tabKey, scrollTop);
    } else {
      const locKey = getLocKey(location.key);
      saveScroll(locKey, scrollTop);
    }

    prevPathnameRef.current = pathname;
  }, [pathname, location.key, isTab, prevIsTab]);

  // Restore scroll position
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    isRestoringRef.current = true;

    let scrollToRestore: number | null = null;

    if (navigationType === 'POP') {
      // Back/Forward: try location key first, then tab key
      const locKey = getLocKey(location.key);
      scrollToRestore = loadScroll(locKey);
      if (scrollToRestore === null && isTab) {
        const tabKey = getTabKey(pathname);
        scrollToRestore = loadScroll(tabKey);
      }
    } else {
      // PUSH/REPLACE: restore tab position if navigating to tab, otherwise start at top
      if (isTab) {
        const tabKey = getTabKey(pathname);
        scrollToRestore = loadScroll(tabKey);
      } else {
        scrollToRestore = 0;
      }
    }

    if (scrollToRestore !== null) {
      el.scrollTop = scrollToRestore;
      lastScrollRef.current = scrollToRestore;
    } else {
      el.scrollTop = 0;
      lastScrollRef.current = 0;
    }

    // Release restore flag after browser processes scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isRestoringRef.current = false;
      });
    });
  }, [pathname, location.key, navigationType, isTab]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        overflow: 'hidden',
      }}
    >
      <main
        ref={mainRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          background: 'linear-gradient(180deg, var(--app-bg-1) 0%, var(--app-bg-2) 100%)',
          backgroundAttachment: 'local',
          contain: 'paint',
          minHeight: '100%',
          width: '100%',
          paddingTop: 'var(--safe-top, 0px)',
          paddingBottom: 'calc(var(--tabs-h) + var(--safe-bottom, 0px))',
        }}
      >
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
}
