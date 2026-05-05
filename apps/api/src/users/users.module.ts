import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { UsersRepository } from './users.repository.js';
import { ReferralAttributionRepository } from './referral-attribution.repository.js';
import { ReferralAttributionService } from './referral-attribution.service.js';

@Module({
  providers: [
    {
      provide: UsersRepository,
      useFactory: (pool: Pool) => new UsersRepository(pool),
      inject: [Pool],
    },
    {
      provide: ReferralAttributionRepository,
      useFactory: (pool: Pool) => new ReferralAttributionRepository(pool),
      inject: [Pool],
    },
    ReferralAttributionService,
  ],
  exports: [UsersRepository, ReferralAttributionRepository, ReferralAttributionService],
})
export class UsersModule {}
