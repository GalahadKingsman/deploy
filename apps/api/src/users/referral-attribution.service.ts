import { Injectable, Logger } from '@nestjs/common';
import { ReferralAttributionRepository } from './referral-attribution.repository.js';

/**
 * Display name shown when a user has no first/last name (or one of them).
 * Used in `Вас пригласил …` and `Кого вы пригласили` blocks.
 */
export function buildReferralDisplayName(parts: {
  firstName: string | null;
  lastName: string | null;
  fallbackUserId: string;
}): string {
  const first = (parts.firstName ?? '').trim();
  const last = (parts.lastName ?? '').trim();
  const joined = [first, last].filter((s) => s.length > 0).join(' ');
  if (joined) return joined;
  const id = parts.fallbackUserId.trim();
  if (id.length >= 8) return `Пользователь ${id.slice(0, 8)}`;
  return 'Пользователь';
}

@Injectable()
export class ReferralAttributionService {
  private readonly log = new Logger(ReferralAttributionService.name);

  constructor(private readonly repository: ReferralAttributionRepository) {}

  /**
   * First-wins attribution. Idempotent and safe: silently does nothing when
   * the code is missing/unknown, points to the user themselves, or attribution
   * already exists.
   *
   * Returns whether this call was the one that wrote the link (mostly for tests/logs).
   */
  async tryAttributeByCode(params: {
    userId: string;
    rawCode: string | null | undefined;
  }): Promise<boolean> {
    const code = (params.rawCode ?? '').trim();
    if (!code) return false;
    try {
      const referrer = await this.repository.findReferrerByCode(code);
      if (!referrer) return false;
      if (referrer.id === params.userId) return false;
      return await this.repository.setReferrerIfMissing({
        userId: params.userId,
        referrerUserId: referrer.id,
      });
    } catch (e) {
      this.log.warn(
        `Referral attribution failed for user=${params.userId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return false;
    }
  }
}
