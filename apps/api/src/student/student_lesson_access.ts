import type { ContractsV1 } from '@tracked/shared';
import type { StudentCoursesRepository } from './student_courses.repository.js';
import type { ProgressRepository } from './student_progress.repository.js';

export type CourseLessonAccess = {
  completedLessonIds: string[];
  unlockedLessonIds: string[];
  nextUnlockedLessonId: string | null;
};

/**
 * Access rule:
 * - completed lessons are always accessible
 * - plus exactly one next lesson (first incomplete in course order)
 */
export async function computeCourseLessonAccess(params: {
  userId: string;
  courseId: string;
  coursesRepository: StudentCoursesRepository;
  progressRepository: ProgressRepository;
}): Promise<CourseLessonAccess> {
  const [lessons, completed] = await Promise.all([
    params.coursesRepository.listLessonsByCourseId(params.courseId),
    params.progressRepository.listCompletedLessonIdsByCourse({
      userId: params.userId,
      courseId: params.courseId,
    }),
  ]);

  const completedSet = new Set(completed);
  let next: ContractsV1.LessonV1 | null = null;
  for (const l of lessons) {
    if (!completedSet.has(l.id)) {
      next = l;
      break;
    }
  }

  const unlocked = new Set<string>(completed);
  if (next) unlocked.add(next.id);

  return {
    completedLessonIds: completed,
    unlockedLessonIds: Array.from(unlocked),
    nextUnlockedLessonId: next?.id ?? null,
  };
}

