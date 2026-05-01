import { Inject, Injectable, Optional } from '@nestjs/common';
import { Pool } from 'pg';

export type SupportRouting = {
  supportGroupId: string;
  outboundMessageId: string;
  customerTelegramId: string;
};

@Injectable()
export class SupportRoutingRepository {
  constructor(@Optional() @Inject(Pool) private readonly pool: Pool | null) {}

  async upsert(params: {
    supportGroupId: string;
    outboundMessageId: string;
    customerTelegramId: string;
  }): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO support_message_routing (support_group_id, outbound_message_id, customer_telegram_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (support_group_id, outbound_message_id)
       DO UPDATE SET customer_telegram_id = EXCLUDED.customer_telegram_id`,
      [params.supportGroupId, params.outboundMessageId, params.customerTelegramId],
    );
  }

  async findCustomer(params: {
    supportGroupId: string;
    outboundMessageId: string;
  }): Promise<string | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<{ customer_telegram_id: string }>(
      `SELECT customer_telegram_id::text AS customer_telegram_id
       FROM support_message_routing
       WHERE support_group_id = $1 AND outbound_message_id = $2
       LIMIT 1`,
      [params.supportGroupId, params.outboundMessageId],
    );
    return res.rows[0]?.customer_telegram_id ?? null;
  }
}
