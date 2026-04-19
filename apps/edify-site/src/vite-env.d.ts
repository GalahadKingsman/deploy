/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый URL API (например https://api.edify.su) — подключите позже к тем же ручкам, что и мини-приложение. */
  readonly VITE_API_BASE_URL?: string;
  /** Логин «Войти» → https://t.me/<username>?start=site */
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
