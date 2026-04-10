import { z } from 'zod';
import type { CourseV1 } from './course.js';
import { CourseV1Schema } from './course.js';

export interface MyCourseProgressV1 {
  course: CourseV1;
  progressPercent: number;
}

export const MyCourseProgressV1Schema = z.object({
  course: CourseV1Schema,
  progressPercent: z.number().int().min(0).max(100),
});

export interface MeCoursesResponseV1 {
  items: MyCourseProgressV1[];
}

export const MeCoursesResponseV1Schema = z.object({
  items: z.array(MyCourseProgressV1Schema),
});

