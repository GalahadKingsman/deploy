import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { AssignmentsRepository } from './assignments.repository.js';
import { AssignmentFilesRepository } from './assignment-files.repository.js';

@Module({
  providers: [
    {
      provide: AssignmentsRepository,
      useFactory: (pool: Pool) => new AssignmentsRepository(pool),
      inject: [Pool],
    },
    {
      provide: AssignmentFilesRepository,
      useFactory: (pool: Pool) => new AssignmentFilesRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [AssignmentsRepository, AssignmentFilesRepository],
})
export class AssignmentsModule {}

