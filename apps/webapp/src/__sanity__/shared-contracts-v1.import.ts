/**
 * Sanity check: compile-only assertion that ContractsV1 exports are available
 * This file is never imported anywhere - it's a compile-time check only.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ContractsV1 } from '@tracked/shared';

// Compile-time assertions (unused vars are intentional for type checking)
type _AssertUserV1 = ContractsV1.UserV1;
type _AssertCourseV1 = ContractsV1.CourseV1;
type _AssertLessonV1 = ContractsV1.LessonV1;
type _AssertInviteV1 = ContractsV1.InviteV1;
type _AssertSubmissionV1 = ContractsV1.SubmissionV1;
type _AssertApiErrorV1 = ContractsV1.ApiErrorV1;
type _AssertApiErrorResponseV1 = ContractsV1.ApiErrorResponseV1;
type _AssertGetMeResponseV1 = ContractsV1.GetMeResponseV1;
type _AssertGetLibraryResponseV1 = ContractsV1.GetLibraryResponseV1;
type _AssertGetLearnSummaryResponseV1 = ContractsV1.GetLearnSummaryResponseV1;
type _AssertGetCourseResponseV1 = ContractsV1.GetCourseResponseV1;
type _AssertGetLessonResponseV1 = ContractsV1.GetLessonResponseV1;

// Assert that schemas are available
type _AssertUserV1Schema = typeof ContractsV1.UserV1Schema;
type _AssertApiErrorResponseV1Schema = typeof ContractsV1.ApiErrorResponseV1Schema;

// This file exports nothing - it's compile-only
export {};
