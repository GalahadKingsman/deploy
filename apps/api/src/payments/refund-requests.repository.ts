import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ContractsV1 } from '@tracked/shared';

interface RefundRow {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_at: Date;
}

export class RefundRequestsRepository {
  constructor(private readonly pool: Pool | null) {}

  async create(params: { orderId: string; createdByUserId: string | null; note: string | null }): Promise<ContractsV1.PaymentRefundRequestV1> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const id = randomUUID();
    const res = await this.pool.query<RefundRow>(
      `
      INSERT INTO payment_refund_requests (id, order_id, status, created_by_user_id, note)
      VALUES ($1, $2, 'stub_in_development', $3, $4)
      RETURNING *
      `,
      [id, params.orderId, params.createdByUserId, params.note],
    );
    return this.mapRow(res.rows[0]);
  }

  async listByOrderId(orderId: string): Promise<ContractsV1.PaymentRefundRequestV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<RefundRow>(
      `SELECT * FROM payment_refund_requests WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId],
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: RefundRow): ContractsV1.PaymentRefundRequestV1 {
    return {
      id: r.id,
      orderId: r.order_id,
      status: r.status,
      note: r.note,
      createdAt: r.created_at.toISOString(),
    };
  }
}
