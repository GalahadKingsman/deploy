import { Module } from '@nestjs/common';
import { ExpertsModule } from '../experts/experts.module.js';
import { LibraryController } from './student_library.controller.js';
import { CoursesController } from './student_courses.controller.js';
import { LessonsController } from './student_lessons.controller.js';
import { LearnController } from './student_learn.controller.js';
import { MeCoursesController } from './student_me_courses.controller.js';
import { MeCertificatesController } from './student_me_certificates.controller.js';
import { AccessController } from './student_access.controller.js';
import { StudentAssignmentsController } from './student_assignments.controller.js';
import { StudentSubmissionsController } from './student_submissions.controller.js';
import { StudentUploadsController } from './student_uploads.controller.js';
import { UsersModule } from '../users/users.module.js';
import { JwtModule } from '../auth/session/jwt.module.js';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/session/optional-jwt-auth.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { AccessDataModule } from '../access/access-data.module.js';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AuthoringModule } from '../authoring/authoring.module.js';
import { StudentTopicsController } from './student_topics.controller.js';
import { StudentCourseStructureController } from './student_course_structure.controller.js';
import { StudentLessonMaterialsController } from './student_lesson_materials.controller.js';

@Module({
  imports: [
    ExpertsModule,
    UsersModule,
    AuthoringModule,
    JwtModule,
    AuditModule,
    AccessDataModule,
    AssignmentsModule,
    SubmissionsModule,
    StorageModule,
  ],
  controllers: [
    LibraryController,
    CoursesController,
    LessonsController,
    StudentLessonMaterialsController,
    LearnController,
    MeCoursesController,
    MeCertificatesController,
    AccessController,
    StudentAssignmentsController,
    StudentSubmissionsController,
    StudentUploadsController,
    StudentTopicsController,
    StudentCourseStructureController,
  ],
  providers: [JwtAuthGuard, OptionalJwtAuthGuard],
})
export class StudentModule {}

