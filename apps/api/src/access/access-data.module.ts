import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { StudentCoursesRepository } from '../student/student_courses.repository.js';
import { EnrollmentsRepository } from '../student/student_enrollments.repository.js';
import { InvitesRepository } from '../student/student_invites.repository.js';
import { ProgressRepository } from '../student/student_progress.repository.js';

@Module({
  providers: [
    {
      provide: StudentCoursesRepository,
      useFactory: (pool: Pool) => new StudentCoursesRepository(pool),
      inject: [Pool],
    },
    {
      provide: EnrollmentsRepository,
      useFactory: (pool: Pool) => new EnrollmentsRepository(pool),
      inject: [Pool],
    },
    {
      provide: InvitesRepository,
      useFactory: (pool: Pool) => new InvitesRepository(pool),
      inject: [Pool],
    },
    {
      provide: ProgressRepository,
      useFactory: (pool: Pool) => new ProgressRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [StudentCoursesRepository, EnrollmentsRepository, InvitesRepository, ProgressRepository],
})
export class AccessDataModule {}

