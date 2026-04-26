import type { ContractsV1 } from '@tracked/shared';
import type { StudentCoursesRepository } from './student_courses.repository.js';
import type { ProgressRepository } from './student_progress.repository.js';

export type CourseLessonAccess = {
  completedLessonIds: string[];
  unlockedLessonIds: string[];
  nextUnlockedLessonId: string | null;
};

/**
 * Access rules (student-facing, **visible** lessons only; hidden are skipped in order and unlock):
 * - `sequential` (default): same as before — next lesson only after previous is complete; uses only non-hidden lessons in course order.
 * - `open`: all visible lessons are unlocked; still tracks completion and `next` as first incomplete.
 */
export async function computeCourseLessonAccess(params: {
  userId: string;
  courseId: string;
  coursesRepository: StudentCoursesRepository;
  progressRepository: ProgressRepository;
}): Promise<CourseLessonAccess> {
  const [course, lessons, completed] = await Promise.all([
    params.coursesRepository.getCourse(params.courseId),
    params.coursesRepository.listLessonsByCourseId(params.courseId),
    params.progressRepository.listCompletedLessonIdsByCourse({
      userId: params.userId,
      courseId: params.courseId,
    }),
  ]);

  if (!course) {
    return { completedLessonIds: [], unlockedLessonIds: [], nextUnlockedLessonId: null };
  }

  const visibleIdOrder = lessons.map((l) => l.id);
  const completedSet = new Set(completed);
  const mode = course.lessonAccessMode === 'open' ? 'open' : 'sequential';

  let next: ContractsV1.LessonV1 | null = null;
  for (const l of lessons) {
    if (!completedSet.has(l.id)) {
      next = l;
      break;
    }
  }

  const completedVisible = completed;

  if (mode === 'open') {
    return {
      completedLessonIds: completedVisible,
      unlockedLessonIds: visibleIdOrder,
      nextUnlockedLessonId: next?.id ?? null,
    };
  }

  const unlocked = new Set<string>(completedVisible);
  if (next) unlocked.add(next.id);
  return {
    completedLessonIds: completedVisible,
    unlockedLessonIds: Array.from(unlocked),
    nextUnlockedLessonId: next?.id ?? null,
  };
}
