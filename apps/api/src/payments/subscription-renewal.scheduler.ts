import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiEnvSchema, validateOrThrow, type ContractsV1 } from '@tracked/shared';
import { OrdersRepository } from './orders.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { TinkoffAcquiringService } from './tinkoff-acquiring.service.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
import { ExpertsRepository } from '../experts/experts.repository.js';
import { ExpertSubscriptionsRepository } from '../subscriptions/expert-subscriptions.repository.js';

@Injectable()
export class SubscriptionRenewalScheduler {
  private readonly log = new Logger(SubscriptionRenewalScheduler.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly usersRepository: UsersRepository,
    private readonly tinkoff: TinkoffAcquiringService,
    private readonly fulfillment: OrderFulfillmentService,
    private readonly expertsRepository: ExpertsRepository,
    private readonly expertSubscriptionsRepository: ExpertSubscriptionsRepository,
  ) {}

  @Cron('0 7 * * *')
  async runDailyRecurrentCharges(): Promise<void> {
    const env = validateOrThrow(ApiEnvSchema, process.env);
    if (env.PAYMENTS_ENABLED !== true || !this.tinkoff.isConfigured()) {
      return;
    }
    const due = await this.usersRepository.listUserIdsDueForRecurrentCharge();
    for (const row of due) {
      try {
        await this.chargeOne(row);
      } catch (e) {
        this.log.warn(
          `Recurrent renewal failed for user ${row.userId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  private async chargeOne(row: {
    userId: string;
    rebillId: string;
    amountCents: number;
    checkoutProduct: string;
    billingPeriod: string;
  }): Promise<void> {
    const product = row.checkoutProduct as ContractsV1.CheckoutProductV1;
    const billingPeriod = row.billingPeriod as ContractsV1.BillingPeriodV1;
    const periodDays = billingPeriod === 'yearly' ? 365 : 30;

    const order = await this.ordersRepository.createExpertSubscriptionOrder({
      userId: row.userId,
      expertId: null,
      amountCents: row.amountCents,
      currency: 'RUB',
      referralCode: null,
      checkoutProduct: product,
      billingPeriod,
      subscriptionPeriodDays: periodDays,
    });

    const customerKey = await this.usersRepository.getOrCreateTinkoffCustomerKey(row.userId);

    let charge: { paymentId: string; status: string; success: boolean };
    try {
      charge = await this.tinkoff.chargePayment({
        rebillId: row.rebillId,
        amountCents: row.amountCents,
        orderId: order.id,
        customerKey,
        description: 'Продление подписки EDIFY',
      });
    } catch (e) {
      await this.ordersRepository.setOrderStatusIf(order.id, 'failed', ['created']);
      await this.suspendAfterFailedRenewal(row.userId, product);
      throw e;
    }

    await this.ordersRepository.updateProviderFields(order.id, {
      provider: 'tinkoff',
      providerPaymentId: charge.paymentId || null,
      providerStatus: charge.status || null,
      payUrl: null,
    });

    const st = (charge.status ?? '').toUpperCase();
    if (charge.success && st === 'CONFIRMED') {
      const r = await this.fulfillment.completeOrderPayment(order.id);
      if (r.kind !== 'fulfilled' && r.kind !== 'already_paid') {
        this.log.warn(`Renewal fulfill unexpected state for order ${order.id}: ${r.kind}`);
      }
      return;
    }

    if (!charge.success || ['REJECTED', 'DEADLINE_EXPIRED', 'CANCELLED', 'CANCELED'].includes(st)) {
      await this.ordersRepository.setOrderStatusIf(order.id, 'failed', ['created']);
      await this.suspendAfterFailedRenewal(row.userId, product);
    }
  }

  private async suspendAfterFailedRenewal(
    userId: string,
    product: ContractsV1.CheckoutProductV1,
  ): Promise<void> {
    if (product === 'expert_pro') {
      const expert = await this.expertsRepository.findByCreatedByUserId(userId);
      if (expert) {
        await this.expertSubscriptionsRepository.setSuspended(expert.id);
      }
    } else {
      await this.usersRepository.clipPlatformSubscriptionPaidUntilToNow(userId);
    }
  }
}
