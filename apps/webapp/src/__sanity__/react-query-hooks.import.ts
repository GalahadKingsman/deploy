/**
 * Sanity check: compile-only assertion that React Query hooks are properly typed
 * This file is never imported anywhere - it's a compile-time check only.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ContractsV1 } from '@tracked/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  useMe,
  useLibrary,
  useLearnSummary,
  useCourse,
  useLesson,
} from '../shared/queries/index.js';

// Compile-time assertions (unused vars are intentional for type checking)
// These will fail at compile time if hooks don't return correct types
type _AssertUseMeReturn = ReturnType<typeof useMe>;
type _AssertUseLibraryReturn = ReturnType<typeof useLibrary>;
type _AssertUseLearnSummaryReturn = ReturnType<typeof useLearnSummary>;
type _AssertUseCourseReturn = ReturnType<typeof useCourse>;
type _AssertUseLessonReturn = ReturnType<typeof useLesson>;

// Assert that hooks return UseQueryResult
type _AssertMeIsQueryResult =
  _AssertUseMeReturn extends UseQueryResult<ContractsV1.GetMeResponseV1, Error> ? true : never;
type _AssertLibraryIsQueryResult =
  _AssertUseLibraryReturn extends UseQueryResult<ContractsV1.GetLibraryResponseV1, Error>
    ? true
    : never;
type _AssertLearnSummaryIsQueryResult =
  _AssertUseLearnSummaryReturn extends UseQueryResult<ContractsV1.GetLearnSummaryResponseV1, Error>
    ? true
    : never;
type _AssertCourseIsQueryResult =
  _AssertUseCourseReturn extends UseQueryResult<ContractsV1.GetCourseResponseV1, Error>
    ? true
    : never;
type _AssertLessonIsQueryResult =
  _AssertUseLessonReturn extends UseQueryResult<ContractsV1.GetLessonResponseV1, Error>
    ? true
    : never;

// This file exports nothing - it's compile-only
export {};
