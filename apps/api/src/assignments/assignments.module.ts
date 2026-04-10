import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { AssignmentsRepository } from './assignments.repository.js';

@Module({
  providers: [
    {
      provide: AssignmentsRepository,
      useFactory: (pool: Pool) => new AssignmentsRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [AssignmentsRepository],
})
export class AssignmentsModule {}

