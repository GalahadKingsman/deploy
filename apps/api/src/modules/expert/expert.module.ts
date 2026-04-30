import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { JwtModule } from '../../auth/session/jwt.module.js';
import { ExpertRbacModule } from '../../auth/expert-rbac/expert-rbac.module.js';
import { UsersModule } from '../../users/users.module.js';
import { ExpertsModule } from '../../experts/experts.module.js';
import { AuditModule } from '../../audit/audit.module.js';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module.js';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { ExpertController } from './expert.controller.js';
import { AuthoringModule } from '../../authoring/authoring.module.js';
import { ExpertCoursesController } from './expert-courses.controller.js';
import { ExpertModulesController } from './expert-modules.controller.js';
import { ExpertLessonsController } from './expert-lessons.controller.js';
import { ExpertLessonMaterialsController } from './expert-lesson-materials.controller.js';
import { ExpertAccessController } from './expert-access.controller.js';
import { AccessDataModule } from '../../access/access-data.module.js';
import { AssignmentsModule } from '../../assignments/assignments.module.js';
import { SubmissionsModule } from '../../submissions/submissions.module.js';
import { ExpertAssignmentsController } from './expert-assignments.controller.js';
import { ExpertSubmissionsController } from './expert-submissions.controller.js';
import { ExpertTeamController } from './expert-team.controller.js';
import { ExpertCourseTopicsController } from './expert-course-topics.controller.js';
import { ExpertHomeworkController } from './expert-homework.controller.js';
import { ExpertStudentsController } from './expert-students.controller.js';
import { ExpertStudentsRepository } from './expert-students.repository.js';
import { CommissionsRepository } from '../../payments/commissions.repository.js';
import { ExpertDashboardRepository } from './expert-dashboard.repository.js';
import { IntegrationsModule } from '../../integrations/integrations.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { ExpertCourseAccessService } from './expert-course-access.service.js';

@Module({
  imports: [
    JwtModule,
    ExpertRbacModule,
    UsersModule,
    ExpertsModule,
    AuditModule,
    SubscriptionsModule,
    AuthoringModule,
    AccessDataModule,
    AssignmentsModule,
    SubmissionsModule,
    IntegrationsModule,
    StorageModule,
  ],
  controllers: [
    ExpertController,
    ExpertCoursesController,
    ExpertModulesController,
    ExpertLessonsController,
    ExpertLessonMaterialsController,
    ExpertAccessController,
    ExpertAssignmentsController,
    ExpertSubmissionsController,
    ExpertHomeworkController,
    ExpertTeamController,
    ExpertCourseTopicsController,
    ExpertStudentsController,
  ],
  providers: [
    JwtAuthGuard,
    ExpertCourseAccessService,
    ExpertStudentsRepository,
    {
      provide: CommissionsRepository,
      useFactory: (pool: Pool) => new CommissionsRepository(pool),
      inject: [Pool],
    },
    {
      provide: ExpertDashboardRepository,
      useFactory: (pool: Pool, commissions: CommissionsRepository) =>
        new ExpertDashboardRepository(pool, commissions),
      inject: [Pool, CommissionsRepository],
    },
  ],
})
export class ExpertModule {}
