/**
 * Feature flags and configuration
 */

/**
 * API configuration flags
 */
export const config = {
  /**
   * Use MSW for mocking (only in DEV, ignored in PROD)
   */
  USE_MSW: import.meta.env.VITE_USE_MSW === '1' || import.meta.env.VITE_USE_MSW === 'true',

  /**
   * Use real API (disables mocking)
   */
  REAL_API: import.meta.env.VITE_REAL_API === '1' || import.meta.env.VITE_REAL_API === 'true',

  /**
   * API base URL
   */
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',

  /**
   * Маркетинговый сайт (перенос сессии после входа из бота по payload site).
   */
  MARKETING_SITE_URL: (() => {
    const raw =
      typeof import.meta.env.VITE_MARKETING_SITE_URL === 'string'
        ? import.meta.env.VITE_MARKETING_SITE_URL.trim()
        : '';
    return (raw || 'https://edify.su').replace(/\/+$/, '');
  })(),

  /**
   * Браузерные инвайт-ссылки (не Mini App). По умолчанию совпадает с маркетинговым сайтом.
   */
  STUDENT_WEB_BASE_URL: (() => {
    const o = import.meta.env.VITE_STUDENT_WEB_BASE_URL;
    if (typeof o === 'string' && o.trim()) return o.trim().replace(/\/+$/, '');
    const m = import.meta.env.VITE_MARKETING_SITE_URL;
    if (typeof m === 'string' && m.trim()) return m.trim().replace(/\/+$/, '');
    return 'https://edify.su';
  })(),

  /**
   * API prefix (default '/api')
   */
  API_PREFIX: '/api',

  /**
   * Public catalog entrypoints (outside Telegram deep links)
   */
  PUBLIC_CATALOG: import.meta.env.VITE_PUBLIC_CATALOG === '1' || import.meta.env.VITE_PUBLIC_CATALOG === 'true',

  /**
   * Payments UI enabled (frontend only; API is additionally guarded by PAYMENTS_ENABLED)
   */
  PAYMENTS_ENABLED:
    import.meta.env.VITE_PAYMENTS_ENABLED === '1' || import.meta.env.VITE_PAYMENTS_ENABLED === 'true',
} as const;
