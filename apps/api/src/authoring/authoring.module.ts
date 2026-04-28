import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ExpertsModule } from '../experts/experts.module.js';
import { CoursesRepository } from './courses.repository.js';
import { CourseModulesRepository } from './course-modules.repository.js';
import { LessonsRepository } from './lessons.repository.js';
import { ExpertsRepository } from '../experts/experts.repository.js';
import { TopicsRepository } from './topics.repository.js';
import { LessonMaterialFilesRepository } from './lesson-material-files.repository.js';

@Module({
  imports: [ExpertsModule],
  providers: [
    {
      provide: CoursesRepository,
      useFactory: (pool: Pool, expertsRepository: ExpertsRepository) =>
        new CoursesRepository(pool, expertsRepository),
      inject: [Pool, ExpertsRepository],
    },
    {
      provide: CourseModulesRepository,
      useFactory: (pool: Pool) => new CourseModulesRepository(pool),
      inject: [Pool],
    },
    {
      provide: LessonsRepository,
      useFactory: (pool: Pool) => new LessonsRepository(pool),
      inject: [Pool],
    },
    {
      provide: TopicsRepository,
      useFactory: (pool: Pool) => new TopicsRepository(pool),
      inject: [Pool],
    },
    {
      provide: LessonMaterialFilesRepository,
      useFactory: (pool: Pool) => new LessonMaterialFilesRepository(pool),
      inject: [Pool],
    },
  ],
  exports: [CoursesRepository, CourseModulesRepository, LessonsRepository, TopicsRepository, LessonMaterialFilesRepository],
})
export class AuthoringModule {}

