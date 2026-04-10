import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ExpertApplicationsRepository } from './expert-applications.repository.js';

@Module({
  providers: [
    {
      provide: ExpertApplicationsRepository,
      useFactory: (pool: Pool) => new ExpertApplicationsRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [ExpertApplicationsRepository],
})
export class ExpertApplicationsModule {}
