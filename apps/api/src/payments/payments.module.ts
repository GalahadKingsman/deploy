import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { OrdersRepository } from './orders.repository.js';
import { PaymentsController } from './payments.controller.js';
import { TinkoffWebhookController } from './tinkoff-webhook.controller.js';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import { JwtModule } from '../auth/session/jwt.module.js';
import { AccessDataModule } from '../access/access-data.module.js';
import { CommissionsRepository } from './commissions.repository.js';
import { TinkoffAcquiringService } from './tinkoff-acquiring.service.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
import { RefundRequestsRepository } from './refund-requests.repository.js';
import { PayoutRequestsRepository } from './payout-requests.repository.js';
import { AuditModule } from '../audit/audit.module.js';
import { ExpertsModule } from '../experts/experts.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [JwtModule, UsersModule, AccessDataModule, AuditModule, ExpertsModule, SubscriptionsModule],
  controllers: [PaymentsController, TinkoffWebhookController],
  providers: [
    JwtAuthGuard,
    TinkoffAcquiringService,
    OrderFulfillmentService,
    {
      provide: OrdersRepository,
      useFactory: (pool: Pool) => new OrdersRepository(pool),
      inject: [Pool],
    },
    {
      provide: CommissionsRepository,
      useFactory: (pool: Pool) => new CommissionsRepository(pool),
      inject: [Pool],
    },
    {
      provide: RefundRequestsRepository,
      useFactory: (pool: Pool) => new RefundRequestsRepository(pool),
      inject: [Pool],
    },
    {
      provide: PayoutRequestsRepository,
      useFactory: (pool: Pool) => new PayoutRequestsRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [
    OrdersRepository,
    CommissionsRepository,
    OrderFulfillmentService,
    RefundRequestsRepository,
    PayoutRequestsRepository,
  ],
})
export class PaymentsModule {}

