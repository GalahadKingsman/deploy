import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ExpertsRepository } from './experts.repository.js';
import { ExpertMembersRepository } from './expert-members.repository.js';
import { ExpertMemberCourseAccessRepository } from './expert-member-course-access.repository.js';

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
    {
      provide: ExpertMemberCourseAccessRepository,
      useFactory: (pool: Pool) => new ExpertMemberCourseAccessRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [ExpertsRepository, ExpertMembersRepository, ExpertMemberCourseAccessRepository],
})
export class ExpertsModule {}
