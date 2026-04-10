import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ExpertsRepository } from './experts.repository.js';
import { ExpertMembersRepository } from './expert-members.repository.js';

@Module({
  providers: [
    {
      provide: ExpertsRepository,
      useFactory: (pool: Pool) => new ExpertsRepository(pool),
      inject: [Pool],
    },
    {
      provide: ExpertMembersRepository,
      useFactory: (pool: Pool) => new ExpertMembersRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [ExpertsRepository, ExpertMembersRepository],
})
export class ExpertsModule {}
