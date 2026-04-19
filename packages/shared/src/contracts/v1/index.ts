/**
 * Contracts V1 - Public API
 *
 * All exports from this module are available via:
 * import { ContractsV1 } from '@tracked/shared';
 */

// Common types
export type { Id, IsoDateTime, UrlString } from './common.js';

// Entity types
export type { UserV1 } from './user.js';
export type { PlatformRoleV1 } from './platform-role.js';
export type { ExpertV1 } from './expert.js';
export type { ExpertMemberV1, ExpertMemberRoleV1 } from './expert-member.js';
export type {
  ExpertSubscriptionV1,
  ExpertSubscriptionPlanV1,
  ExpertSubscriptionStatusV1,
} from './subscription.js';
export type { CourseV1 } from './course.js';
export type { LessonV1, LessonVideoV1 } from './lesson.js';
export type {
  EnrollmentV1,
  ExpertEnrollmentRowV1,
  ListExpertCourseEnrollmentsResponseV1,
  ExtendEnrollmentRequestV1,
} from './enrollment.js';
export type {
  TopicV1,
  ListTopicsResponseV1,
  ListCourseTopicsResponseV1,
  SetCourseTopicsRequestV1,
} from './topic.js';
export type { AddExpertTeamMemberRequestV1, UpdateExpertTeamMemberRoleRequestV1 } from './expert-team-mgmt.js';
export type {
  ActivateInviteRequestV1,
  ActivateInviteResponseV1,
  CompleteLessonRequestV1,
  CompleteLessonResponseV1,
} from './access.js';
export type {
  ExpertCourseV1,
  CourseStatusV1,
  CourseVisibilityV1,
  ListExpertCoursesResponseV1,
  CreateExpertCourseRequestV1,
  UpdateExpertCourseRequestV1,
} from './expert-course.js';
export type {
  ExpertCourseModuleV1,
  ListExpertCourseModulesResponseV1,
  CreateExpertCourseModuleRequestV1,
  UpdateExpertCourseModuleRequestV1,
  ReorderExpertCourseModulesRequestV1,
} from './expert-module.js';
export type {
  ExpertLessonV1,
  ListExpertLessonsResponseV1,
  CreateExpertLessonRequestV1,
  UpdateExpertLessonRequestV1,
  ReorderExpertLessonsRequestV1,
} from './expert-lesson.js';
export type { InviteV1 } from './invite.js';
export type {
  AssignmentV1,
  AssignmentFileV1,
  SubmissionStatusV1,
  UpsertAssignmentRequestV1,
} from './assignment.js';
export type {
  GetLessonAssignmentResponseV1,
  CreateSubmissionRequestV1,
  CreateSubmissionResponseV1,
  ListLessonSubmissionsResponseV1,
  DecideSubmissionRequestV1,
} from './assignments-api.js';
export type { SubmissionV1 } from './submission.js';
export type {
  OrderV1,
  OrderStatusV1,
  CreateCourseCheckoutRequestV1,
  CreateCourseCheckoutResponseV1,
  MeOrdersResponseV1,
} from './orders.js';
export type { GetMyReferralResponseV1 } from './referral.js';
export { GetMyReferralResponseV1Schema } from './referral.js';
export type { CommissionV1, MeCommissionsResponseV1 } from './commission.js';
export { CommissionV1Schema, MeCommissionsResponseV1Schema } from './commission.js';
export type { MeReferralStatsResponseV1 } from './referral-stats.js';
export { MeReferralStatsResponseV1Schema } from './referral-stats.js';
export type {
  MeContactV1,
  GetMyContactResponseV1,
  UpdateMyContactRequestV1,
  UpdateMyContactResponseV1,
} from './contact.js';
export {
  MeContactV1Schema,
  GetMyContactResponseV1Schema,
  UpdateMyContactRequestV1Schema,
  UpdateMyContactResponseV1Schema,
} from './contact.js';
export type { ExpertApplicationV1, ExpertApplicationStatusV1 } from './expert-application.js';
export type { MeExpertApplicationResponseV1 } from './me-expert-application.js';
export type { MeExpertMembershipsResponseV1 } from './me-expert-memberships.js';
export type { MeCoursesResponseV1, MyCourseProgressV1 } from './me-courses.js';
export type { ExpertTeamMemberV1, ListExpertTeamResponseV1 } from './expert-team.js';
export type {
  PaymentRefundRequestV1,
  ListPaymentRefundRequestsResponseV1,
} from './refund.js';
export type {
  PartnerPayoutRequestV1,
  ListMyPayoutRequestsResponseV1,
  CreatePartnerPayoutRequestV1,
} from './payout.js';

// Error types
export type { ApiErrorV1, ApiErrorResponseV1 } from './errors.js';

// Endpoint DTO types
export type {
  GetMeResponseV1,
  GetLibraryResponseV1,
  GetLearnSummaryResponseV1,
  GetCourseResponseV1,
  GetLessonResponseV1,
  ListModuleLessonsResponseV1,
} from './endpoints.js';

// Auth types
export type {
  AuthTelegramRequestV1,
  AuthTelegramResponseV1,
  AuthSiteBridgeIssueResponseV1,
  AuthSiteBridgeClaimRequestV1,
} from './auth.js';

// Audit log types (admin read)
export type { AuditLogEntryV1, AuditLogListResponseV1 } from './audit-log.js';

// Zod schemas (for runtime validation)
export {
  UserV1Schema,
  PlatformRoleV1Schema,
  ExpertV1Schema,
  ExpertMemberV1Schema,
  ExpertMemberRoleV1Schema,
  ExpertSubscriptionPlanV1Schema,
  ExpertSubscriptionStatusV1Schema,
  ExpertSubscriptionV1Schema,
  CourseV1Schema,
  LessonV1Schema,
  EnrollmentV1Schema,
  ActivateInviteRequestV1Schema,
  ActivateInviteResponseV1Schema,
  CompleteLessonRequestV1Schema,
  CompleteLessonResponseV1Schema,
  CourseStatusV1Schema,
  CourseVisibilityV1Schema,
  ExpertCourseV1Schema,
  ListExpertCoursesResponseV1Schema,
  CreateExpertCourseRequestV1Schema,
  UpdateExpertCourseRequestV1Schema,
  ExpertCourseModuleV1Schema,
  ListExpertCourseModulesResponseV1Schema,
  CreateExpertCourseModuleRequestV1Schema,
  UpdateExpertCourseModuleRequestV1Schema,
  ReorderExpertCourseModulesRequestV1Schema,
  ExpertLessonV1Schema,
  ListExpertLessonsResponseV1Schema,
  CreateExpertLessonRequestV1Schema,
  UpdateExpertLessonRequestV1Schema,
  ReorderExpertLessonsRequestV1Schema,
  InviteV1Schema,
  AssignmentV1Schema,
  SubmissionStatusV1Schema,
  UpsertAssignmentRequestV1Schema,
  GetLessonAssignmentResponseV1Schema,
  CreateSubmissionRequestV1Schema,
  CreateSubmissionResponseV1Schema,
  ListLessonSubmissionsResponseV1Schema,
  DecideSubmissionRequestV1Schema,
  SubmissionV1Schema,
  OrderV1Schema,
  OrderStatusV1Schema,
  CreateCourseCheckoutRequestV1Schema,
  CreateCourseCheckoutResponseV1Schema,
  MeOrdersResponseV1Schema,
  ApiErrorV1Schema,
  ApiErrorResponseV1Schema,
  GetMeResponseV1Schema,
  GetLibraryResponseV1Schema,
  GetLearnSummaryResponseV1Schema,
  GetCourseResponseV1Schema,
  GetLessonResponseV1Schema,
  ListModuleLessonsResponseV1Schema,
  AuthTelegramRequestV1Schema,
  AuthTelegramResponseV1Schema,
  AuthSiteBridgeIssueResponseV1Schema,
  AuthSiteBridgeClaimRequestV1Schema,
  AuditLogEntryV1Schema,
  AuditLogListResponseV1Schema,
  ExpertApplicationStatusV1Schema,
  ExpertApplicationV1Schema,
  MeExpertApplicationResponseV1Schema,
  MeExpertMembershipsResponseV1Schema,
  MeCoursesResponseV1Schema,
  MyCourseProgressV1Schema,
  ExpertTeamMemberV1Schema,
  ListExpertTeamResponseV1Schema,
  PaymentRefundRequestV1Schema,
  ListPaymentRefundRequestsResponseV1Schema,
  PartnerPayoutRequestV1Schema,
  ListMyPayoutRequestsResponseV1Schema,
  CreatePartnerPayoutRequestV1Schema,
  ExtendEnrollmentRequestV1Schema,
  ExpertEnrollmentRowV1Schema,
  ListExpertCourseEnrollmentsResponseV1Schema,
  TopicV1Schema,
  ListTopicsResponseV1Schema,
  ListCourseTopicsResponseV1Schema,
  SetCourseTopicsRequestV1Schema,
  AddExpertTeamMemberRequestV1Schema,
  UpdateExpertTeamMemberRoleRequestV1Schema,
} from './schemas.js';
