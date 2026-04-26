import { z } from 'zod';

export interface ExpertStudentRowV1 {
  enrollmentId: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  streakDays: number;
  lastPlatformVisitAt: string | null;
  doneLessons: number;
  totalLessons: number;
  progressPercent: number;
  homeworkSubmittedCount: number;
  homeworkAvgScore: number | null;
}

export interface ListExpertStudentsResponseV1 {
  items: ExpertStudentRowV1[];
  totalUniqueStudents: number;
  activeLast7DaysUnique: number;
  avgCompletionPercent: number | null;
  globalAvgHomeworkScore: number | null;
}

export const ExpertStudentRowV1Schema = z.object({
  enrollmentId: z.string().uuid(),
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  streakDays: z.number().int().nonnegative(),
  lastPlatformVisitAt: z.string().nullable(),
  doneLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  progressPercent: z.number().int().min(0).max(100),
  homeworkSubmittedCount: z.number().int().nonnegative(),
  homeworkAvgScore: z.number().min(1).max(5).nullable(),
});

export const ListExpertStudentsResponseV1Schema = z.object({
  items: z.array(ExpertStudentRowV1Schema),
  totalUniqueStudents: z.number().int().nonnegative(),
  activeLast7DaysUnique: z.number().int().nonnegative(),
  avgCompletionPercent: z.number().min(0).max(100).nullable(),
  globalAvgHomeworkScore: z.number().min(1).max(5).nullable(),
});
