import { http, HttpResponse, passthrough } from 'msw';
import { ContractsV1 } from '@tracked/shared';
import {
  mockUser,
  mockCourses,
  getMockCourse,
  getMockLessons,
  getMockLesson,
  paginate,
  mockExpertSubscriptionActive,
  mockExpertSubscriptionExpired,
  getMockExpertApplicationResponse,
} from './fixtures.js';

/**
 * MSW handlers for API endpoints
 * All responses conform to ContractsV1 DTOs
 */

export const handlers = [
  /**
   * GET /me - Get current user
   * Error scenario: ?error=unauthorized returns 401
   */
  http.get('/api/me', ({ request }) => {
    const url = new URL(request.url);

    // Error scenario: unauthorized
    if (url.searchParams.get('error') === 'unauthorized') {
      const errorResponse: ContractsV1.ApiErrorResponseV1 = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: `req-${Date.now()}`,
        },
      };
      return HttpResponse.json(errorResponse, { status: 401 });
    }

    // Normal response
    const response: ContractsV1.GetMeResponseV1 = {
      user: mockUser,
    };
    return HttpResponse.json(response);
  }),

  /**
   * GET /library - Get library (courses and recommended)
   * Supports limit/offset query parameters
   * Error scenario: ?error=server returns 500
   */
  http.get('/api/library', ({ request }) => {
    const url = new URL(request.url);

    // Error scenario: server error
    if (url.searchParams.get('error') === 'server') {
      const errorResponse: ContractsV1.ApiErrorResponseV1 = {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: `req-${Date.now()}`,
          details: {
            timestamp: new Date().toISOString(),
          },
        },
      };
      return HttpResponse.json(errorResponse, { status: 500 });
    }

    // Normal response
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    // Filter published courses
    const publishedCourses = mockCourses.filter((c) => c.status === 'published');

    // Apply pagination to courses
    const { items: courses } = paginate(publishedCourses, limit, offset);

    // Recommended courses (first 2 published)
    const recommended = publishedCourses.slice(0, 2);

    const response: ContractsV1.GetLibraryResponseV1 = {
      courses,
      recommended,
    };

    return HttpResponse.json(response);
  }),

  /**
   * GET /learn/summary - Get learn summary (active course and next lesson)
   */
  http.get('/api/learn/summary', () => {
    // Return first published course as active
    const activeCourse = mockCourses.find((c) => c.status === 'published');
    const activeCourseId = activeCourse?.id;

    // Get first lesson of active course
    const nextLesson = activeCourseId ? getMockLessons(activeCourseId)[0] : undefined;

    const response: ContractsV1.GetLearnSummaryResponseV1 = {
      activeCourse: activeCourse || null,
      nextLesson: nextLesson || null,
    };

    return HttpResponse.json(response);
  }),

  /**
   * GET /courses/:id - Get course by ID
   * Error scenario: ?error=forbidden returns 403
   */
  http.get('/api/courses/:id', ({ params, request }) => {
    const { id } = params;
    const url = new URL(request.url);

    // Error scenario: forbidden
    if (url.searchParams.get('error') === 'forbidden') {
      const errorResponse: ContractsV1.ApiErrorResponseV1 = {
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this course',
          requestId: `req-${Date.now()}`,
        },
      };
      return HttpResponse.json(errorResponse, { status: 403 });
    }

    // Normal response
    const course = getMockCourse(id as string);

    if (!course) {
      const errorResponse: ContractsV1.ApiErrorResponseV1 = {
        error: {
          code: 'NOT_FOUND',
          message: `Course with id "${id}" not found`,
          requestId: `req-${Date.now()}`,
        },
      };
      return HttpResponse.json(errorResponse, { status: 404 });
    }

    const lessons = getMockLessons(course.id);

    const response: ContractsV1.GetCourseResponseV1 = {
      course,
      lessons,
    };

    return HttpResponse.json(response);
  }),

  /**
   * GET /lessons/:id - Get lesson by ID
   */
  http.get('/api/lessons/:id', ({ params }) => {
    const { id } = params;
    const lesson = getMockLesson(id as string);

    if (!lesson) {
      const errorResponse: ContractsV1.ApiErrorResponseV1 = {
        error: {
          code: 'NOT_FOUND',
          message: `Lesson with id "${id}" not found`,
          requestId: `req-${Date.now()}`,
        },
      };
      return HttpResponse.json(errorResponse, { status: 404 });
    }

    const response: ContractsV1.GetLessonResponseV1 = {
      lesson,
    };

    return HttpResponse.json(response);
  }),

  /**
   * GET /me/expert-subscription — Story 5.4 (read path in 5.5)
   * Query ?expertCta=none|expired|active for dev UX (default: none → 404).
   * 404 in unified error format (ApiErrorResponseV1) so fetcher maps to NONE.
   */
  http.get('/me/expert-subscription', ({ request }) => {
    const url = new URL(request.url);
    const state = url.searchParams.get('expertCta') ?? 'none';

    if (state === 'none') {
      const errorResponse: ContractsV1.ApiErrorResponseV1 = {
        error: {
          code: 'NOT_FOUND',
          message: 'No expert subscription',
          requestId: `req-${Date.now()}`,
        },
      };
      return HttpResponse.json(errorResponse, { status: 404 });
    }

    if (state === 'expired') {
      return HttpResponse.json(mockExpertSubscriptionExpired);
    }

    return HttpResponse.json(mockExpertSubscriptionActive);
  }),

  /**
   * GET /api/me/expert-subscription — same, for apps that use /api prefix
   */
  http.get('/api/me/expert-subscription', ({ request }) => {
    const url = new URL(request.url);
    const state = url.searchParams.get('expertCta') ?? 'none';

    if (state === 'none') {
      const errorResponse: ContractsV1.ApiErrorResponseV1 = {
        error: {
          code: 'NOT_FOUND',
          message: 'No expert subscription',
          requestId: `req-${Date.now()}`,
        },
      };
      return HttpResponse.json(errorResponse, { status: 404 });
    }

    if (state === 'expired') {
      return HttpResponse.json(mockExpertSubscriptionExpired);
    }

    return HttpResponse.json(mockExpertSubscriptionActive);
  }),

  /**
   * GET /me/expert-application — Story 5.6
   * Query ?expertApp=none|pending|rejected|approved for dev UX; else passthrough to real API.
   */
  http.get('/me/expert-application', ({ request }) => {
    const url = new URL(request.url);
    const expertApp = url.searchParams.get('expertApp');
    if (
      expertApp !== 'none' &&
      expertApp !== 'pending' &&
      expertApp !== 'rejected' &&
      expertApp !== 'approved'
    ) {
      return passthrough();
    }
    const response = getMockExpertApplicationResponse(
      expertApp as 'none' | 'pending' | 'rejected' | 'approved',
    );
    return HttpResponse.json(response);
  }),

  /**
   * GET /api/me/expert-application — same, for apps that use /api prefix
   */
  http.get('/api/me/expert-application', ({ request }) => {
    const url = new URL(request.url);
    const expertApp = url.searchParams.get('expertApp');
    if (
      expertApp !== 'none' &&
      expertApp !== 'pending' &&
      expertApp !== 'rejected' &&
      expertApp !== 'approved'
    ) {
      return passthrough();
    }
    const response = getMockExpertApplicationResponse(
      expertApp as 'none' | 'pending' | 'rejected' | 'approved',
    );
    return HttpResponse.json(response);
  }),

  /**
   * POST /me/expert-application — Story 5.6
   * Query ?expertApp=... for dev mock; else passthrough to real API.
   */
  http.post('/me/expert-application', ({ request }) => {
    const url = new URL(request.url);
    const expertApp = url.searchParams.get('expertApp');
    if (
      expertApp !== 'none' &&
      expertApp !== 'pending' &&
      expertApp !== 'rejected' &&
      expertApp !== 'approved'
    ) {
      return passthrough();
    }
    const response = getMockExpertApplicationResponse(
      expertApp === 'none' ? 'pending' : (expertApp as 'pending' | 'rejected' | 'approved'),
    );
    return HttpResponse.json(response);
  }),

  /**
   * POST /api/me/expert-application — same
   */
  http.post('/api/me/expert-application', ({ request }) => {
    const url = new URL(request.url);
    const expertApp = url.searchParams.get('expertApp');
    if (
      expertApp !== 'none' &&
      expertApp !== 'pending' &&
      expertApp !== 'rejected' &&
      expertApp !== 'approved'
    ) {
      return passthrough();
    }
    const response = getMockExpertApplicationResponse(
      expertApp === 'none' ? 'pending' : (expertApp as 'pending' | 'rejected' | 'approved'),
    );
    return HttpResponse.json(response);
  }),
];
