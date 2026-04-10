import type { UserV1 } from './user.js';
import type { CourseV1 } from './course.js';
import type { LessonV1 } from './lesson.js';
import { z } from 'zod';
import { UserV1Schema } from './user.js';
import { CourseV1Schema } from './course.js';
import { LessonV1Schema } from './lesson.js';

/**
 * GetMeResponse V1
 */
export interface GetMeResponseV1 {
  user: UserV1;
}

/**
 * Zod schema for GetMeResponseV1
 */
export const GetMeResponseV1Schema = z.object({
  user: UserV1Schema,
});

/**
 * GetLibraryResponse V1
 */
export interface GetLibraryResponseV1 {
  courses: CourseV1[];
  recommended: CourseV1[];
}

/**
 * Zod schema for GetLibraryResponseV1
 */
export const GetLibraryResponseV1Schema = z.object({
  courses: z.array(CourseV1Schema),
  recommended: z.array(CourseV1Schema),
});

/**
 * GetLearnSummaryResponse V1
 */
export interface GetLearnSummaryResponseV1 {
  activeCourse?: CourseV1 | null;
  nextLesson?: LessonV1 | null;
}

/**
 * Zod schema for GetLearnSummaryResponseV1
 */
export const GetLearnSummaryResponseV1Schema = z.object({
  activeCourse: CourseV1Schema.nullable().optional(),
  nextLesson: LessonV1Schema.nullable().optional(),
});

/**
 * GetCourseResponse V1
 */
export interface GetCourseResponseV1 {
  course: CourseV1;
  lessons: LessonV1[];
}

/**
 * Zod schema for GetCourseResponseV1
 */
export const GetCourseResponseV1Schema = z.object({
  course: CourseV1Schema,
  lessons: z.array(LessonV1Schema),
});

/**
 * GetLessonResponse V1
 */
export interface GetLessonResponseV1 {
  lesson: LessonV1;
}

/**
 * Zod schema for GetLessonResponseV1
 */
export const GetLessonResponseV1Schema = z.object({
  lesson: LessonV1Schema,
});
