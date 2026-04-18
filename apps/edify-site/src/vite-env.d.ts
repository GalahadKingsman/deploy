/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый URL API (например https://api.edify.su) — подключите позже к тем же ручкам, что и мини-приложение. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
