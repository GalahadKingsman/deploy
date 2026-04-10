/**
 * Contracts V1 - Public API
 *
 * All exports from this module are available via:
 * import { ContractsV1 } from '@tracked/shared';
 */
// Zod schemas (for runtime validation)
export {
  UserV1Schema,
  CourseV1Schema,
  LessonV1Schema,
  InviteV1Schema,
  SubmissionV1Schema,
  ApiErrorV1Schema,
  ApiErrorResponseV1Schema,
  GetMeResponseV1Schema,
  GetLibraryResponseV1Schema,
  GetLearnSummaryResponseV1Schema,
  GetCourseResponseV1Schema,
  GetLessonResponseV1Schema,
  AuthTelegramRequestV1Schema,
  AuthTelegramResponseV1Schema,
} from './schemas.js';
