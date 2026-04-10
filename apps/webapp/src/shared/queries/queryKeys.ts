/**
 * Query keys for React Query
 * Stable tuple-based keys for cache management
 */

/**
 * Query key for /me endpoint
 */
export const me = () => ['me'] as const;

/**
 * Query key for /me/expert-subscription (Story 5.4; API in 5.5)
 */
export const meExpertSubscription = () => ['me', 'expert-subscription'] as const;

/**
 * Query key for /me/expert-application (Story 5.6)
 */
export const meExpertApplication = () => ['me', 'expert-application'] as const;

/**
 * Query key for /library endpoint
 */
export const library = (params?: { limit?: number; offset?: number }) => {
  if (!params || Object.keys(params).length === 0) {
    return ['library'] as const;
  }
  return ['library', params] as const;
};

/**
 * Query key for /learn/summary endpoint
 */
export const learnSummary = () => ['learn', 'summary'] as const;

/**
 * Query key for /courses/:id endpoint
 */
export const course = (courseId: string) => ['courses', courseId] as const;

/**
 * Query key for /lessons/:id endpoint
 */
export const lesson = (lessonId: string) => ['lessons', lessonId] as const;

export const lessonAssignment = (lessonId: string) => ['lessons', lessonId, 'assignment'] as const;

export const lessonSubmissions = (lessonId: string) =>
  ['lessons', lessonId, 'submissions'] as const;
