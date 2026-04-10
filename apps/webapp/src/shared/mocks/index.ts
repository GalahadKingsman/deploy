/**
 * MSW mocks - Public exports
 *
 * ⚠️ CRITICAL for Story 2.5: Service Worker fallback required
 *
 * Telegram iOS WebView often doesn't support Service Worker, and MSW in browser
 * relies on Service Worker. Story 2.5 MUST implement a safe fallback mechanism
 * to prevent app breakage in Safari/Telegram iOS WebView.
 *
 * Implementation approach for 2.5:
 * - Check Service Worker availability before initializing MSW worker
 * - Fallback to real API if Service Worker is unavailable
 * - Use feature flag (VITE_USE_MSW) to control MSW usage
 * - Never block app initialization if MSW fails to start
 */

export { handlers } from './handlers.js';
export {
  mockUser,
  mockCourses,
  mockLessons,
  getMockCourse,
  getMockLessons,
  getMockLesson,
  paginate,
} from './fixtures.js';
