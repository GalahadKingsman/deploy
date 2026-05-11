import type { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';

type AdminJoinRow = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  amount_cents: number;
  card_pan: string;
  phone: string;
  bank_name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  decided_at: Date | null;
  decided_by_user_id: string | null;
};

type Row = {
  id: string;
  user_id: string;
  amount_cents: number;
  card_pan: string;
  phone: string;
  bank_name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  decided_at: Date | null;
  decided_by_user_id: string | null;
};

function mapRow(r: Row): ContractsV1.ReferralWithdrawalRequestV1 {
  return {
    id: r.id,
    userId: r.user_id,
    amountCents: r.amount_cents,
    cardPan: r.card_pan,
    phone: r.phone,
    bankName: r.bank_name,
    status: r.status as ContractsV1.ReferralWithdrawalStatusV1,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
    decidedByUserId: r.decided_by_user_id,
  };
}

export class ReferralWithdrawalRequestsRepository {
  constructor(private readonly pool: Pool | null) {}

  async hasPendingForUser(userId: string): Promise<boolean> {
    if (!this.pool) return false;
    const res = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM referral_withdrawal_requests WHERE user_id = $1 AND status = 'pending'`,
      [userId],
    );
    return (parseInt(res.rows[0]?.c ?? '0', 10) || 0) > 0;
  }

  async sumApprovedAmountCentsForUser(userId: string): Promise<number> {
    if (!this.pool) return 0;
    const res = await this.pool.query<{ s: string }>(
      `
      SELECT COALESCE(SUM(amount_cents), 0)::text AS s
      FROM referral_withdrawal_requests
      WHERE user_id = $1 AND status = 'approved'
      `,
      [userId],
    );
    return Math.max(0, parseInt(res.rows[0]?.s ?? '0', 10) || 0);
  }

  async listForUser(userId: string): Promise<ContractsV1.ReferralWithdrawalRequestV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<Row>(
      `
      SELECT * FROM referral_withdrawal_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [userId],
    );
    return res.rows.map(mapRow);
  }

  async create(params: {
    userId: string;
    amountCents: number;
    cardPan: string;
    phone: string;
    bankName: string;
  }): Promise<ContractsV1.ReferralWithdrawalRequestV1> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const res = await this.pool.query<Row>(
      `
      INSERT INTO referral_withdrawal_requests
        (user_id, amount_cents, card_pan, phone, bank_name, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
      RETURNING *
      `,
      [params.userId, params.amountCents, params.cardPan, params.phone, params.bankName],
    );
    const r = res.rows[0];
    if (!r) throw new Error('Insert referral_withdrawal_requests returned no row');
    return mapRow(r);
  }

  async listAdminRows(params: { limit: number; offset: number }): Promise<ContractsV1.AdminReferralWithdrawalRowV1[]> {
    if (!this.pool) return [];
    const limit = Math.min(Math.max(1, params.limit), 200);
    const offset = Math.max(0, params.offset);
    const res = await this.pool.query<{
      id: string;
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      amount_cents: number;
      card_pan: string;
      phone: string;
      bank_name: string;
      status: string;
      created_at: Date;
      updated_at: Date;
      decided_at: Date | null;
      decided_by_user_id: string | null;
    }>(
      `
      SELECT
        r.id,
        r.user_id,
        u.first_name,
        u.last_name,
        r.amount_cents,
        r.card_pan,
        r.phone,
        r.bank_name,
        r.status,
        r.created_at,
        r.updated_at,
        r.decided_at,
        r.decided_by_user_id
      FROM referral_withdrawal_requests r
      JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );
    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      amountCents: row.amount_cents,
      cardPan: row.card_pan,
      phone: row.phone,
      bankName: row.bank_name,
      status: row.status as ContractsV1.ReferralWithdrawalStatusV1,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
      decidedByUserId: row.decided_by_user_id,
    }));
  }

  async findById(id: string): Promise<ContractsV1.AdminReferralWithdrawalRowV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<{
      id: string;
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      amount_cents: number;
      card_pan: string;
      phone: string;
      bank_name: string;
      status: string;
      created_at: Date;
      updated_at: Date;
      decided_at: Date | null;
      decided_by_user_id: string | null;
    }>(
      `
      SELECT
        r.id,
        r.user_id,
        u.first_name,
        u.last_name,
        r.amount_cents,
        r.card_pan,
        r.phone,
        r.bank_name,
        r.status,
        r.created_at,
        r.updated_at,
        r.decided_at,
        r.decided_by_user_id
      FROM referral_withdrawal_requests r
      JOIN users u ON u.id = r.user_id
      WHERE r.id = $1
      LIMIT 1
      `,
      [id],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      amountCents: row.amount_cents,
      cardPan: row.card_pan,
      phone: row.phone,
      bankName: row.bank_name,
      status: row.status as ContractsV1.ReferralWithdrawalStatusV1,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
      decidedByUserId: row.decided_by_user_id,
    };
  }

  private mapAdminJoinRow(row: AdminJoinRow): ContractsV1.AdminReferralWithdrawalRowV1 {
    return {
      id: row.id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      amountCents: row.amount_cents,
      cardPan: row.card_pan,
      phone: row.phone,
      bankName: row.bank_name,
      status: row.status as ContractsV1.ReferralWithdrawalStatusV1,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
      decidedByUserId: row.decided_by_user_id,
    };
  }

  /** Returns null if not pending or row missing. */
  async tryRejectPending(params: {
    id: string;
    decidedByUserId: string;
  }): Promise<ContractsV1.AdminReferralWithdrawalRowV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<AdminJoinRow>(
      `
      UPDATE referral_withdrawal_requests r
      SET
        status = 'rejected',
        decided_at = NOW(),
        decided_by_user_id = $2,
        updated_at = NOW()
      FROM users u
      WHERE r.id = $1
        AND r.user_id = u.id
        AND r.status = 'pending'
      RETURNING
        r.id,
        r.user_id,
        u.first_name,
        u.last_name,
        r.amount_cents,
        r.card_pan,
        r.phone,
        r.bank_name,
        r.status,
        r.created_at,
        r.updated_at,
        r.decided_at,
        r.decided_by_user_id
      `,
      [params.id, params.decidedByUserId],
    );
    const row = res.rows[0];
    return row ? this.mapAdminJoinRow(row) : null;
  }

  /**
   * Approve only if gross commissions − already approved withdrawals >= this request amount.
   * Returns null if not applicable.
   */
  async tryApprovePending(params: {
    id: string;
    decidedByUserId: string;
  }): Promise<ContractsV1.AdminReferralWithdrawalRowV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<AdminJoinRow>(
      `
      UPDATE referral_withdrawal_requests r
      SET
        status = 'approved',
        decided_at = NOW(),
        decided_by_user_id = $2,
        updated_at = NOW()
      FROM users u
      WHERE r.id = $1
        AND r.user_id = u.id
        AND r.status = 'pending'
        AND (
          COALESCE(
            (SELECT SUM(c.amount_cents) FROM commissions c WHERE c.referral_code = u.referral_code),
            0
          )
          -
          COALESCE(
            (
              SELECT SUM(x.amount_cents)
              FROM referral_withdrawal_requests x
              WHERE x.user_id = r.user_id AND x.status = 'approved'
            ),
            0
          )
        ) >= r.amount_cents
      RETURNING
        r.id,
        r.user_id,
        u.first_name,
        u.last_name,
        r.amount_cents,
        r.card_pan,
        r.phone,
        r.bank_name,
        r.status,
        r.created_at,
        r.updated_at,
        r.decided_at,
        r.decided_by_user_id
      `,
      [params.id, params.decidedByUserId],
    );
    const row = res.rows[0];
    return row ? this.mapAdminJoinRow(row) : null;
  }
}
