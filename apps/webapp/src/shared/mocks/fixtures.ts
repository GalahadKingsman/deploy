import { ContractsV1 } from '@tracked/shared';

/**
 * Mock data fixtures for MSW handlers
 * All fixtures are validated against ContractsV1 schemas
 */

const now = new Date().toISOString();
const pastDate = new Date(Date.now() - 86400000 * 7).toISOString(); // 7 days ago
const futureDate = new Date(Date.now() + 86400000 * 30).toISOString(); // 30 days from now

/**
 * Mock expert subscription fixtures (Story 5.4)
 */
export const mockExpertSubscriptionActive: ContractsV1.ExpertSubscriptionV1 = {
  expertId: '00000000-0000-0000-0000-000000000001',
  plan: 'free_stub',
  status: 'active',
  currentPeriodStart: now,
  currentPeriodEnd: futureDate,
  priceCents: 0,
};

export const mockExpertSubscriptionExpired: ContractsV1.ExpertSubscriptionV1 = {
  expertId: '00000000-0000-0000-0000-000000000001',
  plan: 'free_stub',
  status: 'expired',
  currentPeriodStart: pastDate,
  currentPeriodEnd: pastDate,
  priceCents: 0,
};

/**
 * Mock expert application fixtures (Story 5.6)
 * expertApp=none → application: null; expertApp=pending|rejected|approved → application with that status
 */
function mockExpertApplication(
  status: 'pending' | 'rejected' | 'approved',
): ContractsV1.ExpertApplicationV1 {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    userId: '00000000-0000-0000-0000-000000000002',
    status,
    note: status === 'rejected' ? 'Previous note' : null,
    adminNote: status === 'rejected' ? 'Not enough experience' : null,
    createdAt: now,
    updatedAt: now,
    decidedAt: status !== 'pending' ? now : null,
    decidedByUserId: status !== 'pending' ? '00000000-0000-0000-0000-000000000003' : null,
  };
}

export function getMockExpertApplicationResponse(
  expertApp: 'none' | 'pending' | 'rejected' | 'approved',
): ContractsV1.MeExpertApplicationResponseV1 {
  if (expertApp === 'none') {
    return { application: null };
  }
  return { application: mockExpertApplication(expertApp) };
}

/**
 * Mock user fixture
 */
export const mockUser: ContractsV1.UserV1 = {
  id: 'user-1',
  telegramUserId: '123456789',
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  avatarUrl: 'https://example.com/avatar.jpg',
  createdAt: pastDate,
  updatedAt: now,
};

/**
 * Mock courses fixtures
 */
export const mockCourses: ContractsV1.CourseV1[] = [
  {
    id: 'course-1',
    title: 'Introduction to TypeScript',
    description: 'Learn TypeScript from scratch',
    coverUrl: 'https://example.com/course-1.jpg',
    authorName: 'Jane Smith',
    lessonsCount: 5,
    updatedAt: now,
    status: 'published',
    visibility: 'public',
  },
  {
    id: 'course-2',
    title: 'Advanced React Patterns',
    description: 'Master advanced React patterns and best practices',
    coverUrl: 'https://example.com/course-2.jpg',
    authorName: 'John Doe',
    lessonsCount: 8,
    updatedAt: now,
    status: 'published',
    visibility: 'public',
  },
  {
    id: 'course-3',
    title: 'Node.js Backend Development',
    description: 'Build scalable backend applications with Node.js',
    coverUrl: null,
    authorName: 'Alice Johnson',
    lessonsCount: 12,
    updatedAt: now,
    status: 'published',
    visibility: 'public',
  },
  {
    id: 'course-4',
    title: 'Draft Course',
    description: 'This course is still in draft',
    authorName: 'Bob Wilson',
    lessonsCount: 0,
    updatedAt: now,
    status: 'draft',
    visibility: 'private',
  },
];

/**
 * Mock lessons fixtures
 */
export const mockLessons: Record<string, ContractsV1.LessonV1[]> = {
  'course-1': [
    {
      id: 'lesson-1-1',
      courseId: 'course-1',
      title: 'Getting Started with TypeScript',
      order: 1,
      contentMarkdown: '# Getting Started\n\nWelcome to TypeScript!',
      updatedAt: now,
      video: { kind: 'youtube', youtubeId: 'dQw4w9WgXcQ' },
    },
    {
      id: 'lesson-1-2',
      courseId: 'course-1',
      title: 'Types and Interfaces',
      order: 2,
      contentMarkdown: '# Types and Interfaces\n\nLearn about TypeScript types.',
      updatedAt: now,
      video: { kind: 'none' },
    },
  ],
  'course-2': [
    {
      id: 'lesson-2-1',
      courseId: 'course-2',
      title: 'React Hooks Deep Dive',
      order: 1,
      contentMarkdown: '# React Hooks\n\nUnderstanding React hooks.',
      updatedAt: now,
      video: {
        kind: 'upload',
        key: 'video/lesson-2-1.mp4',
        mime: 'video/mp4',
        size: 1024000,
        originalFilename: 'react-hooks.mp4',
      },
    },
  ],
  'course-3': [
    {
      id: 'lesson-3-1',
      courseId: 'course-3',
      title: 'Setting up Node.js Project',
      order: 1,
      contentMarkdown: '# Node.js Setup\n\nHow to set up a Node.js project.',
      updatedAt: now,
      video: { kind: 'none' },
    },
  ],
};

/**
 * Get mock course by ID
 */
export function getMockCourse(courseId: string): ContractsV1.CourseV1 | undefined {
  return mockCourses.find((c) => c.id === courseId);
}

/**
 * Get mock lessons by course ID
 */
export function getMockLessons(courseId: string): ContractsV1.LessonV1[] {
  return mockLessons[courseId] || [];
}

/**
 * Get mock lesson by ID
 */
export function getMockLesson(lessonId: string): ContractsV1.LessonV1 | undefined {
  for (const lessons of Object.values(mockLessons)) {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) return lesson;
  }
  return undefined;
}

/**
 * Apply pagination to array
 */
export function paginate<T>(
  items: T[],
  limit?: number,
  offset?: number,
): { items: T[]; total: number } {
  const start = offset ?? 0;
  const end = limit ? start + limit : undefined;
  return {
    items: items.slice(start, end),
    total: items.length,
  };
}
