import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ExpertsModule } from '../experts/experts.module.js';
import { ExpertsRepository } from '../experts/experts.repository.js';
import { AuditModule } from '../audit/audit.module.js';
import { ExpertSubscriptionsRepository } from './expert-subscriptions.repository.js';
import { ExpertSubscriptionGuard } from './guards/expert-subscription.guard.js';

@Module({
  imports: [ExpertsModule, AuditModule],
  providers: [
    {
      provide: ExpertSubscriptionsRepository,
      useFactory: (pool: Pool, expertsRepository: ExpertsRepository) =>
        new ExpertSubscriptionsRepository(pool, expertsRepository),
      inject: [Pool, ExpertsRepository],
    },
    ExpertSubscriptionGuard,
  ],
  exports: [ExpertSubscriptionsRepository, ExpertSubscriptionGuard],
})
export class SubscriptionsModule {}
