import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ContractsV1 } from '@tracked/shared';

interface PayoutRow {
  id: string;
  user_id: string;
  amount_cents: number;
  status: string;
  created_at: Date;
}

export class PayoutRequestsRepository {
  constructor(private readonly pool: Pool | null) {}

  async create(params: { userId: string; amountCents: number }): Promise<ContractsV1.PartnerPayoutRequestV1> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const id = randomUUID();
    const res = await this.pool.query<PayoutRow>(
      `
      INSERT INTO partner_payout_requests (id, user_id, amount_cents, status)
      VALUES ($1, $2, $3, 'stub_in_development')
      RETURNING *
      `,
      [id, params.userId, params.amountCents],
    );
    return this.mapRow(res.rows[0]);
  }

  async listByUserId(userId: string): Promise<ContractsV1.PartnerPayoutRequestV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<PayoutRow>(
      `SELECT * FROM partner_payout_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [userId],
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: PayoutRow): ContractsV1.PartnerPayoutRequestV1 {
    return {
      id: r.id,
      amountCents: r.amount_cents ?? 0,
      status: r.status,
      createdAt: r.created_at.toISOString(),
    };
  }
}
