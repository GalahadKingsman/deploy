import { Injectable } from '@nestjs/common';
import { ApiEnvSchema, validateOrThrow, type ContractsV1 } from '@tracked/shared';
import { OrdersRepository } from './orders.repository.js';
import { EnrollmentsRepository } from '../student/student_enrollments.repository.js';
import { CommissionsRepository } from './commissions.repository.js';

export type OrderFulfillmentResult =
  | { kind: 'not_found' }
  | { kind: 'already_paid' }
  | { kind: 'invalid_state'; status: string }
  | { kind: 'fulfilled'; enrollment: ContractsV1.EnrollmentV1 };

@Injectable()
export class OrderFulfillmentService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly commissionsRepository: CommissionsRepository,
  ) {}

  /**
   * Idempotent: if already paid, returns already_paid. Otherwise marks paid, enrolls, records referral commission once.
   */
  async completeOrderPayment(orderId: string): Promise<OrderFulfillmentResult> {
    const order = await this.ordersRepository.findRawById(orderId);
    if (!order) return { kind: 'not_found' };
    if (order.status === 'paid') return { kind: 'already_paid' };
    if (order.status !== 'created') return { kind: 'invalid_state', status: order.status };

    await this.ordersRepository.markPaid(orderId);

    const enrollment = await this.enrollmentsRepository.upsertActive({
      userId: order.userId,
      courseId: order.courseId,
      accessEnd: null,
      referralCode: order.referralCode,
    });

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
