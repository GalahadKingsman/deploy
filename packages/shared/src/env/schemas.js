import { z } from 'zod';
export const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_INITDATA_MAX_AGE_SECONDS: z.coerce.number().default(86400),
});
export const BotEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  BOT_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
export const WebappEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().optional(),
  VITE_USE_MSW: z.string().optional(),
});
