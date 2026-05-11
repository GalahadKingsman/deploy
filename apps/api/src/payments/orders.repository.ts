import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ContractsV1 } from '@tracked/shared';

interface OrderRow {
  id: string;
  user_id: string;
  course_id: string | null;
  expert_id: string | null;
  order_kind: string;
  amount_cents: number;
  currency: string;
  status: string;
  referral_code: string | null;
  provider?: string | null;
  provider_payment_id?: string | null;
  provider_status?: string | null;
  pay_url?: string | null;
  receipt_email?: string | null;
  receipt_phone?: string | null;
  checkout_product?: string | null;
  billing_period?: string | null;
  subscription_period_days?: number | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(r: OrderRow): ContractsV1.OrderV1 {
  const orderKind = (r.order_kind ?? 'course') as ContractsV1.OrderKindV1;
  return {
    id: r.id,
    orderKind,
    courseId: r.course_id ?? null,
    expertId: r.expert_id ?? null,
    userId: r.user_id,
    amountCents: r.amount_cents ?? 0,
    currency: r.currency ?? 'RUB',
    status: r.status as ContractsV1.OrderStatusV1,
    provider: r.provider ?? undefined,
    providerPaymentId: r.provider_payment_id ?? null,
    providerStatus: r.provider_status ?? null,
    payUrl: r.pay_url ?? null,
    receiptEmail: r.receipt_email ?? null,
    receiptPhone: r.receipt_phone ?? null,
    checkoutProduct: (r.checkout_product as ContractsV1.CheckoutProductV1 | null) ?? null,
    billingPeriod: (r.billing_period as ContractsV1.BillingPeriodV1 | null) ?? null,
    subscriptionPeriodDays: r.subscription_period_days ?? null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export class OrdersRepository {
  constructor(private readonly pool: Pool | null) {}

  async countByReferralCode(params: { referralCode: string; status?: string }): Promise<number> {
    if (!this.pool) return 0;
    const values: unknown[] = [params.referralCode];
    let where = `referral_code = $1`;
    if (params.status) {
      values.push(params.status);
      where += ` AND status = $2`;
    }
    const res = await this.pool.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM orders WHERE ${where}`,
      values,
    );
    return parseInt(res.rows[0]?.cnt ?? '0', 10) || 0;
  }

  /**
   * Число приглашённых с хотя бы одной успешной оплатой expert_subscription после referred_at и с ref-кодом пригласившего.
   */
  async existsOtherPaidExpertSubscription(params: { userId: string; excludeOrderId: string }): Promise<boolean> {
    if (!this.pool) return false;
    const res = await this.pool.query<{ exists: boolean }>(
      `
      SELECT EXISTS(
        SELECT 1 FROM orders
        WHERE user_id = $1 AND order_kind = 'expert_subscription' AND status = 'paid' AND id <> $2
      ) AS exists
      `,
      [params.userId, params.excludeOrderId],
    );
    return Boolean(res.rows[0]?.exists);
  }

  async countPaidInviteesExpertSubscription(params: { inviterUserId: string; referralCode: string }): Promise<number> {
    if (!this.pool) return 0;
    const res = await this.pool.query<{ cnt: string }>(
      `
      SELECT COUNT(DISTINCT u.id)::text AS cnt
      FROM users u
      WHERE u.referred_by_user_id = $1
        AND u.referred_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM orders o
          WHERE o.user_id = u.id
            AND o.order_kind = 'expert_subscription'
            AND o.status = 'paid'
            AND o.referral_code = $2
            AND o.created_at >= u.referred_at
        )
      `,
      [params.inviterUserId, params.referralCode],
    );
    return parseInt(res.rows[0]?.cnt ?? '0', 10) || 0;
  }

  async findLatestCreatedExpertSubscriptionByUser(params: {
    userId: string;
    checkoutProduct: ContractsV1.CheckoutProductV1;
    billingPeriod: ContractsV1.BillingPeriodV1;
  }): Promise<ContractsV1.OrderV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<OrderRow>(
      `SELECT * FROM orders
       WHERE user_id = $1 AND order_kind = 'expert_subscription' AND status = 'created'
         AND checkout_product = $2 AND billing_period = $3
       ORDER BY created_at DESC LIMIT 1`,
      [params.userId, params.checkoutProduct, params.billingPeriod],
    );
    const row = res.rows[0];
    return row ? mapRow(row) : null;
  }

  async createExpertSubscriptionOrder(params: {
    userId: string;
    expertId: string | null;
    amountCents: number;
    currency: string;
    referralCode: string | null;
    receiptEmail?: string | null;
    receiptPhone?: string | null;
    checkoutProduct: ContractsV1.CheckoutProductV1;
    billingPeriod: ContractsV1.BillingPeriodV1;
    subscriptionPeriodDays: number;
  }): Promise<ContractsV1.OrderV1> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const id = randomUUID();
    const res = await this.pool.query<OrderRow>(
      `
      INSERT INTO orders (
        id, user_id, course_id, expert_id, order_kind, amount_cents, currency, status,
        referral_code, receipt_email, receipt_phone,
        checkout_product, billing_period, subscription_period_days,
        created_at, updated_at
      )
      VALUES ($1, $2, NULL, $3, 'expert_subscription', $4, $5, 'created', $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
      `,
      [
        id,
        params.userId,
        params.expertId,
        params.amountCents,
        params.currency,
        params.referralCode,
        params.receiptEmail ?? null,
        params.receiptPhone ?? null,
        params.checkoutProduct,
        params.billingPeriod,
        params.subscriptionPeriodDays,
      ],
    );
    return mapRow(res.rows[0]);
  }

  async findByIdForUser(params: { orderId: string; userId: string }): Promise<ContractsV1.OrderV1 | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [params.orderId, params.userId],
    );
    const row = res.rows[0];
    return row ? mapRow(row) : null;
  }

  async findRawById(orderId: string): Promise<{
    id: string;
    userId: string;
    orderKind: ContractsV1.OrderKindV1;
    courseId: string | null;
    expertId: string | null;
    status: string;
    referralCode: string | null;
    amountCents: number;
    currency: string;
    providerPaymentId: string | null;
    checkoutProduct: ContractsV1.CheckoutProductV1 | null;
    billingPeriod: ContractsV1.BillingPeriodV1 | null;
    subscriptionPeriodDays: number | null;
  } | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<OrderRow>(`SELECT * FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      userId: r.user_id,
      orderKind: (r.order_kind ?? 'course') as ContractsV1.OrderKindV1,
      courseId: r.course_id ?? null,
      expertId: r.expert_id ?? null,
      status: r.status,
      referralCode: r.referral_code ?? null,
      amountCents: r.amount_cents ?? 0,
      currency: r.currency ?? 'RUB',
      providerPaymentId: r.provider_payment_id ?? null,
      checkoutProduct: (r.checkout_product as ContractsV1.CheckoutProductV1 | null) ?? null,
      billingPeriod: (r.billing_period as ContractsV1.BillingPeriodV1 | null) ?? null,
      subscriptionPeriodDays: r.subscription_period_days ?? null,
    };
  }

  async setOrderStatusIf(
    orderId: string,
    next: 'failed' | 'cancelled' | 'refunded',
    allowedCurrent: readonly string[],
  ): Promise<boolean> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const res = await this.pool.query(
      `UPDATE orders SET status = $2, updated_at = NOW()
       WHERE id = $1 AND status = ANY($3::text[])
       RETURNING id`,
      [orderId, next, allowedCurrent],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async markPaid(orderId: string): Promise<void> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    await this.pool.query(`UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1`, [orderId]);
  }

  /**
   * Черновик checkout (created): обновить сумму/период после смены env или фикса багов; сбросить провайдера,
   * чтобы следующий Init ушёл с актуальной суммой (и не отдавал старую ссылку Т‑Банка).
   */
  async resetCreatedExpertSubscriptionCheckoutPricing(params: {
    orderId: string;
    userId: string;
    amountCents: number;
    subscriptionPeriodDays: number;
  }): Promise<void> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    await this.pool.query(
      `UPDATE orders SET
         amount_cents = $3,
         subscription_period_days = $4,
         provider = 'tinkoff',
         provider_payment_id = NULL,
         provider_status = NULL,
         pay_url = NULL,
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'created' AND order_kind = 'expert_subscription'`,
      [params.orderId, params.userId, params.amountCents, params.subscriptionPeriodDays],
    );
  }

  async updateProviderFields(
    orderId: string,
    fields: {
      provider?: string;
      providerPaymentId?: string | null;
      providerStatus?: string | null;
      payUrl?: string | null;
    },
  ): Promise<void> {
    if (!this.pool) throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (fields.provider !== undefined) {
      sets.push(`provider = $${i++}`);
      vals.push(fields.provider);
    }
    if (fields.providerPaymentId !== undefined) {
      sets.push(`provider_payment_id = $${i++}`);
      vals.push(fields.providerPaymentId);
    }
    if (fields.providerStatus !== undefined) {
      sets.push(`provider_status = $${i++}`);
      vals.push(fields.providerStatus);
    }
    if (fields.payUrl !== undefined) {
      sets.push(`pay_url = $${i++}`);
      vals.push(fields.payUrl);
    }
    if (!sets.length) return;
    vals.push(orderId);
    sets.push('updated_at = NOW()');
    await this.pool.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  }

  async list(params: {
    limit: number;
    status?: string;
    userId?: string;
    courseId?: string;
  }): Promise<{ items: ContractsV1.OrderV1[] }> {
    if (!this.pool) return { items: [] };
    const limit = Math.min(Math.max(1, params.limit), 200);
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (params.status) {
      conditions.push(`status = $${i}`);
      values.push(params.status);
      i += 1;
    }
    if (params.userId) {
      conditions.push(`user_id = $${i}`);
      values.push(params.userId);
      i += 1;
    }
    if (params.courseId) {
      conditions.push(`course_id = $${i}`);
      values.push(params.courseId);
      i += 1;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);
    const res = await this.pool.query<OrderRow>(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${i}`,
      values,
    );
    return { items: res.rows.map(mapRow) };
  }

  async listByUser(params: { userId: string; limit: number }): Promise<ContractsV1.OrderV1[]> {
    if (!this.pool) return [];
    const limit = Math.min(Math.max(1, params.limit), 200);
    const res = await this.pool.query<OrderRow>(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [params.userId, limit],
    );
    return res.rows.map(mapRow);
  }
}
