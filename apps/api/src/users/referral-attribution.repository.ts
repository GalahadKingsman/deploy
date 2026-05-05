import { Pool } from 'pg';

interface InviterRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  referred_at: Date | null;
}

interface PreviewRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface InviteeRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  referred_at: Date;
  subscription_active: boolean;
  commission_total_cents: string;
  first_paid_expert_subscription_at: Date | null;
}

export class ReferralAttributionRepository {
  constructor(private readonly pool: Pool | null) {}

  /**
   * Resolve referrer user by their `users.referral_code` (the code shared in `?ref=`).
   * Returns null if not found.
   */
  async findReferrerByCode(code: string): Promise<{ id: string } | null> {
    if (!this.pool) return null;
    const trimmed = code.trim();
    if (!trimmed) return null;
    const res = await this.pool.query<{ id: string }>(
      `SELECT id FROM users WHERE referral_code = $1 LIMIT 1`,
      [trimmed],
    );
    return res.rows[0] ?? null;
  }

  /**
   * Public preview by code: only display fields, never email/phone.
   * Returns null when code is unknown.
   */
  async findPreviewByCode(code: string): Promise<PreviewRow | null> {
    if (!this.pool) return null;
    const trimmed = code.trim();
    if (!trimmed) return null;
    const res = await this.pool.query<PreviewRow>(
      `SELECT id, first_name, last_name, avatar_url
       FROM users WHERE referral_code = $1 LIMIT 1`,
      [trimmed],
    );
    return res.rows[0] ?? null;
  }

  /**
   * First-wins attribution: set `referred_by_user_id` and `referred_at` only when both are NULL.
   * Returns true if this call actually persisted the link.
   */
  async setReferrerIfMissing(params: {
    userId: string;
    referrerUserId: string;
  }): Promise<boolean> {
    if (!this.pool) return false;
    if (params.userId === params.referrerUserId) return false;
    const res = await this.pool.query(
      `UPDATE users
         SET referred_by_user_id = $2,
             referred_at = NOW(),
             updated_at = NOW()
       WHERE id = $1
         AND referred_by_user_id IS NULL`,
      [params.userId, params.referrerUserId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Card for `GET /me/referral/inviter`: returns null if user has no referrer.
   */
  async findInviterForUser(userId: string): Promise<InviterRow | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<InviterRow>(
      `SELECT inviter.id AS user_id,
              inviter.first_name,
              inviter.last_name,
              inviter.avatar_url,
              u.referred_at AS referred_at
         FROM users u
         JOIN users inviter ON inviter.id = u.referred_by_user_id
        WHERE u.id = $1
        LIMIT 1`,
      [userId],
    );
    return res.rows[0] ?? null;
  }

  /**
   * List for `GET /me/referral/invitees`. Aggregates per invitee:
   * - subscription_active: is there an expert_members row (role owner|manager) with active expert_subscriptions?
   * - commission_total_cents: SUM(commissions.amount_cents) where the commission is for an order
   *   placed by this invitee with `referral_code = inviter.users.referral_code`.
   * - first_paid_expert_subscription_at: MIN(orders.updated_at) for paid expert_subscription orders
   *   placed by this invitee with the same referral code, only those with order created_at >= referred_at.
   */
  async listInviteesForReferrer(params: {
    referrerUserId: string;
    referralCode: string;
    limit: number;
  }): Promise<InviteeRow[]> {
    if (!this.pool) return [];
    const limit = Math.max(1, Math.min(500, params.limit));
    const res = await this.pool.query<InviteeRow>(
      `WITH invitees AS (
         SELECT u.id        AS user_id,
                u.first_name,
                u.last_name,
                u.avatar_url,
                u.referred_at
           FROM users u
          WHERE u.referred_by_user_id = $1
            AND u.referred_at IS NOT NULL
       ),
       sub_active AS (
         SELECT em.user_id AS user_id,
                BOOL_OR(
                  s.status = 'active'
                  AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
                ) AS active
           FROM expert_members em
           JOIN expert_subscriptions s ON s.expert_id = em.expert_id
          WHERE em.role IN ('owner', 'manager')
            AND em.user_id IN (SELECT user_id FROM invitees)
          GROUP BY em.user_id
       ),
       commissions_per_user AS (
         SELECT o.user_id AS user_id,
                COALESCE(SUM(c.amount_cents), 0) AS total_cents
           FROM commissions c
           JOIN orders o ON o.id = c.order_id
          WHERE c.referral_code = $2
            AND o.user_id IN (SELECT user_id FROM invitees)
          GROUP BY o.user_id
       ),
       first_paid AS (
         SELECT o.user_id AS user_id,
                MIN(o.updated_at) AS first_paid_at
           FROM orders o
           JOIN invitees i ON i.user_id = o.user_id
          WHERE o.order_kind = 'expert_subscription'
            AND o.status = 'paid'
            AND o.referral_code = $2
            AND o.created_at >= i.referred_at
          GROUP BY o.user_id
       )
       SELECT i.user_id,
              i.first_name,
              i.last_name,
              i.avatar_url,
              i.referred_at,
              COALESCE(sa.active, FALSE) AS subscription_active,
              COALESCE(cpu.total_cents, 0)::text AS commission_total_cents,
              fp.first_paid_at AS first_paid_expert_subscription_at
         FROM invitees i
         LEFT JOIN sub_active sa ON sa.user_id = i.user_id
         LEFT JOIN commissions_per_user cpu ON cpu.user_id = i.user_id
         LEFT JOIN first_paid fp ON fp.user_id = i.user_id
        ORDER BY i.referred_at DESC
        LIMIT $3`,
      [params.referrerUserId, params.referralCode, limit],
    );
    return res.rows;
  }
}
