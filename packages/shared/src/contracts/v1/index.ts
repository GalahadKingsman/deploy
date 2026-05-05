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
export type { CourseV1, CourseLessonAccessModeV1 } from './course.js';
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
export type {
  AddExpertTeamMemberRequestV1,
  AddExpertTeamMemberByUserRequestV1,
  ExpertTeamInviteRoleV1,
  UpdateExpertTeamMemberRoleRequestV1,
} from './expert-team-mgmt.js';
export type {
  ActivateInviteRequestV1,
  ActivateInviteResponseV1,
  CompleteLessonRequestV1,
  CompleteLessonResponseV1,
} from './access.js';
export type {
  AuthRegisterRequestV1,
  AuthLoginRequestV1,
  AuthPasswordResponseV1,
  AuthPasswordResetConfirmRequestV1,
  AuthPasswordResetConfirmResponseV1,
  AuthPasswordResetPreviewResponseV1,
  AuthPasswordResetRequestRequestV1,
  AuthPasswordResetRequestResponseV1,
  AdminCreatePasswordResetRequestV1,
  AdminCreatePasswordResetResponseV1,
} from './auth.js';
export {
  AuthRegisterRequestV1Schema,
  AuthLoginRequestV1Schema,
  AuthPasswordResponseV1Schema,
  AuthPasswordResetConfirmRequestV1Schema,
  AuthPasswordResetConfirmResponseV1Schema,
  AuthPasswordResetPreviewResponseV1Schema,
  AuthPasswordResetRequestRequestV1Schema,
  AuthPasswordResetRequestResponseV1Schema,
  AdminCreatePasswordResetRequestV1Schema,
  AdminCreatePasswordResetResponseV1Schema,
} from './auth.js';
export type {
  ExpertCourseV1,
  CourseStatusV1,
  CourseVisibilityV1,
  ListExpertCoursesResponseV1,
  ExpertCourseDashboardItemV1,
  ListExpertCoursesDashboardResponseV1,
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
export type {
  AttestationScopeV1,
  AttestationOptionV1,
  AttestationQuestionV1,
  ExpertAttestationV1,
  ListExpertAttestationsResponseV1,
  CreateExpertAttestationRequestV1,
  UpdateExpertAttestationQuestionOptionV1,
  UpdateExpertAttestationQuestionV1,
  UpdateExpertAttestationRequestV1,
  AttestationAttemptSummaryV1,
  StudentAttestationTreeRowV1,
  StudentAttestationQuestionForAttemptV1,
  GetStudentAttestationForAttemptResponseV1,
  SubmitStudentAttestationRequestV1,
  StudentAttestationReviewQuestionV1,
  SubmitStudentAttestationResponseV1,
  GetStudentAttestationReviewResponseV1,
  ListStudentCourseAttestationsResponseV1,
} from './attestation.js';
export type { InviteV1 } from './invite.js';
export type {
  AssignmentV1,
  AssignmentFileV1,
  SubmissionStatusV1,
  UpsertAssignmentRequestV1,
} from './assignment.js';
export type { LessonMaterialFileV1 } from './lesson-material.js';
export type {
  GetLessonAssignmentResponseV1,
  CreateSubmissionRequestV1,
  CreateSubmissionResponseV1,
  ListLessonSubmissionsResponseV1,
  ListMyRecentSubmissionsResponseV1,
  MyRecentSubmissionItemV1,
  GetNextPendingHomeworkResponseV1,
  NextPendingHomeworkV1,
  DecideSubmissionRequestV1,
} from './assignments-api.js';
export type { ListLessonMaterialsResponseV1 } from './lesson-materials-api.js';
export type { SubmissionV1 } from './submission.js';
export type {
  OrderV1,
  OrderStatusV1,
  OrderKindV1,
  CreateExpertSubscriptionCheckoutRequestV1,
  CreateExpertSubscriptionCheckoutResponseV1,
  MeOrdersResponseV1,
} from './orders.js';
export type { GetMyReferralResponseV1 } from './referral.js';
export { GetMyReferralResponseV1Schema } from './referral.js';
export type { CommissionV1, MeCommissionsResponseV1 } from './commission.js';
export { CommissionV1Schema, MeCommissionsResponseV1Schema } from './commission.js';
export type { MeReferralStatsResponseV1 } from './referral-stats.js';
export { MeReferralStatsResponseV1Schema } from './referral-stats.js';
export type {
  ReferralInviterV1,
  GetMyReferralInviterResponseV1,
  ReferralInviteeV1,
  ListMyReferralInviteesResponseV1,
  ReferralPublicPreviewResponseV1,
} from './referral-attribution.js';
export {
  ReferralInviterV1Schema,
  GetMyReferralInviterResponseV1Schema,
  ReferralInviteeV1Schema,
  ListMyReferralInviteesResponseV1Schema,
  ReferralPublicPreviewResponseV1Schema,
} from './referral-attribution.js';
export type {
  MeContactV1,
  GetMyContactResponseV1,
  UpdateMyContactRequestV1,
  UpdateMyContactResponseV1,
} from './contact.js';
export type { UpdateMyProfileRequestV1, UpdateMyProfileResponseV1 } from './profile.js';
export { UpdateMyProfileRequestV1Schema, UpdateMyProfileResponseV1Schema } from './profile.js';
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
export type { MyCertificateV1, MyCertificatesResponseV1 } from './certificate.js';
export type { ExpertTeamMemberV1, ListExpertTeamResponseV1 } from './expert-team.js';
export type { ExpertStudentRowV1, ListExpertStudentsResponseV1 } from './expert-students.js';
export type {
  ExpertDashboardResponseV1,
  ExpertDashboardPeriodV1,
  ExpertDashboardStudentsV1,
  ExpertDashboardCoursesSummaryV1,
  ExpertDashboardReferralV1,
  ExpertDashboardHomeworkV1,
  ExpertDashboardHomeworkPreviewItemV1,
  ExpertDashboardActivityItemV1,
  ExpertDashboardActivityKindV1,
} from './expert-dashboard.js';
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
  CourseLessonAccessModeV1Schema,
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
  ListExpertCoursesDashboardResponseV1Schema,
  ExpertCourseDashboardItemV1Schema,
  CreateExpertCourseRequestV1Schema,
  UpdateExpertCourseRequestV1Schema,
  isEnrollmentContactUrlAllowed,
  ENROLLMENT_CONTACT_URL_MAX_LEN,
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
  AttestationScopeV1Schema,
  AttestationOptionV1Schema,
  AttestationQuestionV1Schema,
  ExpertAttestationV1Schema,
  ListExpertAttestationsResponseV1Schema,
  CreateExpertAttestationRequestV1Schema,
  UpdateExpertAttestationQuestionOptionV1Schema,
  UpdateExpertAttestationQuestionV1Schema,
  UpdateExpertAttestationRequestV1Schema,
  AttestationAttemptSummaryV1Schema,
  StudentAttestationTreeRowV1Schema,
  StudentAttestationQuestionForAttemptV1Schema,
  GetStudentAttestationForAttemptResponseV1Schema,
  SubmitStudentAttestationRequestV1Schema,
  StudentAttestationReviewQuestionV1Schema,
  SubmitStudentAttestationResponseV1Schema,
  GetStudentAttestationReviewResponseV1Schema,
  ListStudentCourseAttestationsResponseV1Schema,
  InviteV1Schema,
  AssignmentV1Schema,
  SubmissionStatusV1Schema,
  UpsertAssignmentRequestV1Schema,
  GetLessonAssignmentResponseV1Schema,
  CreateSubmissionRequestV1Schema,
  CreateSubmissionResponseV1Schema,
  ListLessonSubmissionsResponseV1Schema,
  ListMyRecentSubmissionsResponseV1Schema,
  MyRecentSubmissionItemV1Schema,
  GetNextPendingHomeworkResponseV1Schema,
  NextPendingHomeworkV1Schema,
  DecideSubmissionRequestV1Schema,
  SubmissionV1Schema,
  OrderV1Schema,
  OrderStatusV1Schema,
  OrderKindV1Schema,
  CreateExpertSubscriptionCheckoutRequestV1Schema,
  CreateExpertSubscriptionCheckoutResponseV1Schema,
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
  MyCertificateV1Schema,
  MyCertificatesResponseV1Schema,
  ExpertTeamMemberV1Schema,
  ListExpertTeamResponseV1Schema,
  ExpertStudentRowV1Schema,
  ListExpertStudentsResponseV1Schema,
  ExpertDashboardResponseV1Schema,
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
  AddExpertTeamMemberByUserRequestV1Schema,
  UpdateExpertTeamMemberRoleRequestV1Schema,
} from './schemas.js';
