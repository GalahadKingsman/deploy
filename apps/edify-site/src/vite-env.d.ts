/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый URL API (например https://api.edify.su) — claim и GET /me */
  readonly VITE_API_BASE_URL?: string;
  /** Логин «Войти» → https://t.me/<username>?start=site */
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
  /** Базовый URL веб-приложения для реф-ссылки (?ref=). Иначе meta `edify-referral-app-base` или https://app.edify.su */
  readonly VITE_REFERRAL_APP_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
