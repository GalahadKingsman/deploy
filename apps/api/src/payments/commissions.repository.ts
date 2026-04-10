import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

interface CommissionRow {
  id: string;
  order_id: string;
  referral_code: string;
  amount_cents: number;
  created_at: Date;
}

export class CommissionsRepository {
  constructor(private readonly pool: Pool | null) {}

  async existsForOrder(orderId: string): Promise<boolean> {
    if (!this.pool) return false;
    const res = await this.pool.query(`SELECT 1 AS x FROM commissions WHERE order_id = $1 LIMIT 1`, [orderId]);
    return (res.rowCount ?? 0) > 0;
  }

  async create(params: { orderId: string; referralCode: string; amountCents: number }): Promise<{ id: string }> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const id = randomUUID();
    await this.pool.query(
      `
      INSERT INTO commissions (id, order_id, referral_code, amount_cents, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      `,
      [id, params.orderId, params.referralCode, params.amountCents],
    );
    return { id };
  }

  async list(params: { limit: number; referralCode?: string }): Promise<{ items: CommissionRow[] }> {
    if (!this.pool) return { items: [] };
    const limit = Math.min(Math.max(1, params.limit), 200);
    if (params.referralCode) {
      const res = await this.pool.query<CommissionRow>(
        `SELECT * FROM commissions WHERE referral_code = $1 ORDER BY created_at DESC LIMIT $2`,
        [params.referralCode, limit],
      );
      return { items: res.rows };
    }
    const res = await this.pool.query<CommissionRow>(
      `SELECT * FROM commissions ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return { items: res.rows };
  }
}

