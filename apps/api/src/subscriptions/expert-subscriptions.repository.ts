import { NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';
import { ErrorCodes } from '@tracked/shared';
import type { ExpertsRepository } from '../experts/experts.repository.js';

interface ExpertSubscriptionDbRow {
  expert_id: string;
  plan: string;
  status: string;
  current_period_start: Date | null;
  current_period_end: Date | null;
  price_cents: number;
  created_at: Date;
  updated_at: Date;
}

const DEFAULT_PLAN = 'free_stub';
const DEFAULT_STATUS = 'inactive';
const DEFAULT_PRICE_CENTS = 0;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class ExpertSubscriptionsRepository {
  constructor(
    private readonly pool: Pool | null,
    private readonly expertsRepository: ExpertsRepository,
  ) {}

  async ensureDefault(expertId: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    await this.pool.query(
      `INSERT INTO expert_subscriptions (
        expert_id, plan, status, current_period_start, current_period_end, price_cents, created_at, updated_at
      ) VALUES ($1, $2, $3, NULL, NULL, $4, NOW(), NOW())
      ON CONFLICT (expert_id) DO NOTHING`,
      [expertId, DEFAULT_PLAN, DEFAULT_STATUS, DEFAULT_PRICE_CENTS],
    );
  }

  async findByExpertId(expertId: string): Promise<ContractsV1.ExpertSubscriptionV1 | null> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const result = await this.pool.query<ExpertSubscriptionDbRow>(
      'SELECT * FROM expert_subscriptions WHERE expert_id = $1',
      [expertId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async grantDays(
    expertId: string,
    days: number,
    now: Date = new Date(),
    opts?: { plan?: ContractsV1.ExpertSubscriptionPlanV1 },
  ): Promise<ContractsV1.ExpertSubscriptionV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const expert = await this.expertsRepository.findExpertById(expertId);
    if (!expert) {
      throw new NotFoundException({
        code: ErrorCodes.EXPERT_NOT_FOUND,
        message: 'Expert not found',
      });
    }

    await this.ensureDefault(expertId);
    const current = await this.findByExpertId(expertId);
    if (!current) throw new Error('ensureDefault did not create row');

    const currentEnd = current.currentPeriodEnd ? new Date(current.currentPeriodEnd) : null;
    const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
    const newEnd = new Date(base.getTime() + days * MS_PER_DAY);
    const periodStart = current.currentPeriodStart ? new Date(current.currentPeriodStart) : now;

    const plan = opts?.plan;
    if (plan) {
      await this.pool.query(
        `UPDATE expert_subscriptions
         SET status = 'active', current_period_start = $2, current_period_end = $3, updated_at = $4, plan = $5
         WHERE expert_id = $1`,
        [expertId, periodStart, newEnd, now, plan],
      );
    } else {
      await this.pool.query(
        `UPDATE expert_subscriptions
         SET status = 'active', current_period_start = $2, current_period_end = $3, updated_at = $4
         WHERE expert_id = $1`,
        [expertId, periodStart, newEnd, now],
      );
    }

    const updated = await this.findByExpertId(expertId);
    if (!updated) throw new Error('Row missing after grantDays update');
    return updated;
  }

  async expireNow(
    expertId: string,
    now: Date = new Date(),
  ): Promise<ContractsV1.ExpertSubscriptionV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }

    const expert = await this.expertsRepository.findExpertById(expertId);
    if (!expert) {
      throw new NotFoundException({
        code: ErrorCodes.EXPERT_NOT_FOUND,
        message: 'Expert not found',
      });
    }

    await this.ensureDefault(expertId);

    const current = await this.pool.query<ExpertSubscriptionDbRow>(
      'SELECT * FROM expert_subscriptions WHERE expert_id = $1',
      [expertId],
    );
    const row = current.rows[0];
    const periodStart = row?.current_period_start ?? now;

    await this.pool.query(
      `UPDATE expert_subscriptions
       SET status = 'expired', current_period_start = $2, current_period_end = $3, updated_at = $3
       WHERE expert_id = $1`,
      [expertId, periodStart, now],
    );

    const updated = await this.findByExpertId(expertId);
    if (!updated) throw new Error('Row missing after expireNow update');
    return updated;
  }

  private mapRow(row: ExpertSubscriptionDbRow): ContractsV1.ExpertSubscriptionV1 {
    return {
      expertId: row.expert_id,
      plan: row.plan as ContractsV1.ExpertSubscriptionPlanV1,
      status: row.status as ContractsV1.ExpertSubscriptionStatusV1,
      currentPeriodStart: row.current_period_start ? row.current_period_start.toISOString() : null,
      currentPeriodEnd: row.current_period_end ? row.current_period_end.toISOString() : null,
      priceCents: row.price_cents,
    };
  }
}
