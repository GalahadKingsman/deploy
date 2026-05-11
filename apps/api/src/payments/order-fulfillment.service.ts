import { Injectable } from '@nestjs/common';
import { ApiEnvSchema, validateOrThrow, type ContractsV1 } from '@tracked/shared';
import { randomUUID } from 'node:crypto';
import { OrdersRepository } from './orders.repository.js';
import { EnrollmentsRepository } from '../student/student_enrollments.repository.js';
import { CommissionsRepository } from './commissions.repository.js';
import { ExpertSubscriptionsRepository } from '../subscriptions/expert-subscriptions.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { ExpertsRepository } from '../experts/experts.repository.js';
import { ExpertMembersRepository } from '../experts/expert-members.repository.js';

export type OrderFulfillmentResult =
  | { kind: 'not_found' }
  | { kind: 'already_paid' }
  | { kind: 'invalid_state'; status: string }
  /** Для оплаты курса (legacy) — зачисление; для подписки эксперта — `enrollment` = null. */
  | { kind: 'fulfilled'; enrollment: ContractsV1.EnrollmentV1 | null };

@Injectable()
export class OrderFulfillmentService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly commissionsRepository: CommissionsRepository,
    private readonly expertSubscriptionsRepository: ExpertSubscriptionsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly expertsRepository: ExpertsRepository,
    private readonly expertMembersRepository: ExpertMembersRepository,
  ) {}

  /**
   * Idempotent: if already paid, returns already_paid. Otherwise marks paid.
   * expert_subscription: по `checkout_product` — платформа или воркспейс эксперта.
   * course (legacy): зачисляет на курс.
   * Реферальная комиссия — от суммы заказа expert_subscription при наличии referral_code.
   */
  async completeOrderPayment(orderId: string): Promise<OrderFulfillmentResult> {
    const order = await this.ordersRepository.findRawById(orderId);
    if (!order) return { kind: 'not_found' };
    if (order.status === 'paid') return { kind: 'already_paid' };
    if (order.status !== 'created') return { kind: 'invalid_state', status: order.status };

    await this.ordersRepository.markPaid(orderId);

    let enrollment: ContractsV1.EnrollmentV1 | null = null;

    if (order.orderKind === 'expert_subscription') {
      const env = validateOrThrow(ApiEnvSchema, process.env);
      const days =
        order.subscriptionPeriodDays != null && order.subscriptionPeriodDays > 0
          ? order.subscriptionPeriodDays
          : (env.EXPERT_SUBSCRIPTION_CHECKOUT_PERIOD_DAYS ?? 30);
      const product: ContractsV1.CheckoutProductV1 =
        order.checkoutProduct === 'expert_pro' ? 'expert_pro' : 'platform_entry';

      if (product === 'platform_entry') {
        await this.usersRepository.extendPlatformSubscriptionPaidUntil({
          userId: order.userId,
          days,
        });
      }

      // И «Начать», и «Эксперт» дают воркспейс + активную expert_subscription (кабинет /me/expert-*).
      let expert = await this.expertsRepository.findByCreatedByUserId(order.userId);
      if (!expert) {
        const user = await this.usersRepository.findById(order.userId);
        const baseTitle = (user?.firstName ?? '').trim() || 'Эксперт';
        const expertId = randomUUID();
        const slug = `ex-${expertId.replace(/-/g, '').slice(0, 10)}`;
        expert = await this.expertsRepository.createExpert({
          id: expertId,
          title: baseTitle,
          slug,
          createdByUserId: order.userId,
        });
        await this.expertMembersRepository.addMember({
          expertId: expert.id,
          userId: order.userId,
          role: 'owner',
        });
      }
      await this.expertSubscriptionsRepository.ensureDefault(expert.id);
      await this.expertSubscriptionsRepository.grantDays(expert.id, days, new Date(), { plan: 'paid' });

      const billingPeriod: ContractsV1.BillingPeriodV1 =
        order.billingPeriod === 'yearly' ? 'yearly' : 'monthly';
      await this.usersRepository.updateLastSubscriptionBillingSnapshot({
        userId: order.userId,
        checkoutProduct: product,
        billingPeriod,
        amountCents: order.amountCents,
      });

      const hadOtherPaid = await this.ordersRepository.existsOtherPaidExpertSubscription({
        userId: order.userId,
        excludeOrderId: orderId,
      });
      if (!hadOtherPaid) {
        await this.usersRepository.enableSubscriptionAutoRenew(order.userId);
      }
    } else if (order.orderKind === 'course' && order.courseId) {
      enrollment = await this.enrollmentsRepository.upsertActive({
        userId: order.userId,
        courseId: order.courseId,
        accessEnd: null,
        referralCode: order.referralCode,
      });
    }

    const env = validateOrThrow(ApiEnvSchema, process.env);
    const bps = env.PAYMENTS_REFERRAL_COMMISSION_BPS ?? 0;
    if (order.referralCode && !(await this.commissionsRepository.existsForOrder(orderId))) {
      const amountCents = Math.floor((order.amountCents * bps) / 10000);
      await this.commissionsRepository.create({
        orderId,
        referralCode: order.referralCode,
        amountCents,
      });
    }

    return { kind: 'fulfilled', enrollment };
  }
}
