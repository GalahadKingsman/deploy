/**
 * Re-exports of all Zod schemas for Contracts V1
 *
 * This file aggregates all schemas for convenient import.
 */
export { UserV1Schema } from './user.js';
export { CourseV1Schema } from './course.js';
export { LessonV1Schema } from './lesson.js';
export { InviteV1Schema } from './invite.js';
export { SubmissionV1Schema } from './submission.js';
export { ApiErrorV1Schema, ApiErrorResponseV1Schema } from './errors.js';
export {
  GetMeResponseV1Schema,
  GetLibraryResponseV1Schema,
  GetLearnSummaryResponseV1Schema,
  GetCourseResponseV1Schema,
  GetLessonResponseV1Schema,
} from './endpoints.js';
export { AuthTelegramRequestV1Schema, AuthTelegramResponseV1Schema } from './auth.js';
