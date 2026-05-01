import { z } from 'zod';

function emptyToUndefined(val: unknown): unknown {
  if (val === '' || val === null || val === undefined) return undefined;
  return val;
}

export const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  /** Comma-separated list of allowed origins in production (e.g. https://app.example.com,https://admin.example.com). */
  CORS_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
  S3_ENDPOINT: z.string().optional(),
  /**
   * Base URL for presigned GET/PUT links returned to the browser (Telegram WebView).
   * Must be reachable from the user's device — not a Docker-internal host like http://minio:9000.
   * Example: https://s3.example.com or http://YOUR_VPS_IP:9000 if MinIO port is published.
   * When omitted, S3_ENDPOINT is used (fine for local dev when it is already localhost/public).
   */
  S3_PUBLIC_ENDPOINT: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  BOT_INTERNAL_TOKEN: z.string().optional(),
  /**
   * Telegram chat ID of the support supergroup (usually a negative number, e.g. -1001234567890).
   * When set, the bot relays user messages from "Чат с поддержкой" into this group, and admin
   * replies (Reply on the bot's post) are forwarded back to the user. Empty disables the feature.
   */
  TELEGRAM_SUPPORT_GROUP_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  RATE_LIMIT_MAX: z.coerce.number().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().optional(),
  PAYMENTS_ENABLED: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return false;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const normalized = val.toLowerCase().trim();
        return normalized === '1' || normalized === 'true';
      }
      return false;
    }, z.boolean())
    .default(false),
  /** Referral commission on paid orders: basis points (100 = 1%). Default 0. */
  PAYMENTS_REFERRAL_COMMISSION_BPS: z.coerce.number().int().min(0).max(1_000_000).default(0),
  /** Tinkoff Acquiring (eCom) — TerminalKey from lk */
  TINKOFF_TERMINAL_KEY: z.string().optional().default(''),
  TINKOFF_PASSWORD: z.string().optional().default(''),
  TINKOFF_API_BASE_URL: z.string().url().default('https://securepay.tinkoff.ru'),
  TINKOFF_NOTIFICATION_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  TINKOFF_SUCCESS_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  TINKOFF_FAIL_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  /** Receipt FFD: Taxation, e.g. usn_income, osn */
  TINKOFF_RECEIPT_TAXATION: z.string().min(1).default('usn_income'),
  /** Item VAT: none, vat10, vat22, … */
  TINKOFF_RECEIPT_TAX: z.string().min(1).default('none'),
  TELEGRAM_INITDATA_MAX_AGE_SECONDS: z.coerce.number().default(86400),
  OWNER_TELEGRAM_USER_ID: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  // Access token TTL (seconds). Production default is 14 days.
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().default(14 * 24 * 60 * 60),
  /** Публичный origin сайта (лендинг), без завершающего слэша. Ссылки в письмах сброса пароля: https://edify.su */
  PUBLIC_WEB_ORIGIN: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  /** true для порта 465 (SSL), false для 587 STARTTLS */
  SMTP_SECURE: z
    .preprocess((v) => {
      if (v === undefined || v === null || v === '') return undefined;
      if (typeof v === 'boolean') return v;
      const s = String(v).toLowerCase().trim();
      return s === '1' || s === 'true' || s === 'yes';
    }, z.boolean().optional()),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /** From: для писем, например EDIFY <noreply@edify.su> */
  MAIL_FROM: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /** Лимит запросов сброса пароля на один email за окно (антиспам). */
  PASSWORD_RESET_MAX_PER_EMAIL: z.coerce.number().int().min(1).max(50).default(5),
  PASSWORD_RESET_WINDOW_MS: z.coerce.number().int().min(60_000).max(86_400_000).default(3_600_000),
  SWAGGER_ENABLED: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return false;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        // Only '1' or 'true' (case-insensitive) are truthy
        // Everything else ('0', 'false', '', etc.) is falsy
        const normalized = val.toLowerCase().trim();
        return normalized === '1' || normalized === 'true';
      }
      return false;
    }, z.boolean())
    .default(false),
});

export const BotEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  BOT_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  BOT_API_BASE_URL: z.string().default('http://localhost:3001'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  BOT_INTERNAL_TOKEN: z.string().optional(),
  /**
   * Telegram chat ID of the support supergroup. When set, "Чат с поддержкой" messages are relayed
   * here and admin replies (Reply on the bot's post) are forwarded back to the user.
   */
  TELEGRAM_SUPPORT_GROUP_ID: z.string().optional(),
});

export const WebappEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().optional(),
  VITE_USE_MSW: z.string().optional(),
  /**
   * Telegram bot username without @ (used to generate deep links like https://t.me/<bot>?start=...)
   * Optional: UI can fall back to manual entry if unset.
   */
  VITE_TELEGRAM_BOT_USERNAME: z.string().optional(),
  /**
   * Telegram Mini App short name (the part in t.me/<bot>/<shortName>).
   * Used to generate direct Mini App deep links: https://t.me/<bot>/<shortName>?startapp=...
   */
  VITE_TELEGRAM_APP_SHORT_NAME: z.string().optional(),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;
export type BotEnv = z.infer<typeof BotEnvSchema>;
export type WebappEnv = z.infer<typeof WebappEnvSchema>;
