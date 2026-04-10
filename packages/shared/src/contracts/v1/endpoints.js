import { z } from 'zod';
import { UserV1Schema } from './user.js';
import { CourseV1Schema } from './course.js';
import { LessonV1Schema } from './lesson.js';
/**
 * Zod schema for GetMeResponseV1
 */
export const GetMeResponseV1Schema = z.object({
  user: UserV1Schema,
});
/**
 * Zod schema for GetLibraryResponseV1
 */
export const GetLibraryResponseV1Schema = z.object({
  courses: z.array(CourseV1Schema),
  recommended: z.array(CourseV1Schema),
});
/**
 * Zod schema for GetLearnSummaryResponseV1
 */
export const GetLearnSummaryResponseV1Schema = z.object({
  activeCourse: CourseV1Schema.nullable().optional(),
  nextLesson: LessonV1Schema.nullable().optional(),
});
/**
 * Zod schema for GetCourseResponseV1
 */
export const GetCourseResponseV1Schema = z.object({
  course: CourseV1Schema,
  lessons: z.array(LessonV1Schema),
});
/**
 * Zod schema for GetLessonResponseV1
 */
export const GetLessonResponseV1Schema = z.object({
  lesson: LessonV1Schema,
});
