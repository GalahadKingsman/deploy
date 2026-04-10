import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { SubmissionsRepository } from './submissions.repository.js';

@Module({
  providers: [
    {
      provide: SubmissionsRepository,
      useFactory: (pool: Pool) => new SubmissionsRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [SubmissionsRepository],
})
export class SubmissionsModule {}

