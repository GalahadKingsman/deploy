import { Injectable } from '@nestjs/common';
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';

/** In-memory лимит запросов сброса пароля по ключу (например IP:email). */
@Injectable()
export class PasswordResetRequestThrottle {
  private readonly buckets = new Map<string, number[]>();

  isAllowed(key: string): boolean {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    const max = env.PASSWORD_RESET_MAX_PER_EMAIL;
    const windowMs = env.PASSWORD_RESET_WINDOW_MS;
    const now = Date.now();
    const arr = this.buckets.get(key) ?? [];
    const fresh = arr.filter((t) => now - t < windowMs);
    if (fresh.length >= max) return false;
    fresh.push(now);
    this.buckets.set(key, fresh);
    return true;
  }
}
