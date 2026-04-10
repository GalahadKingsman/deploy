import { fetchJson } from './fetchJson.js';
import { ContractsV1 } from '@tracked/shared';

/**
 * Dev-only API probe for testing error states
 * Only available in development mode
 */

if (import.meta.env.DEV) {
  const probe = {
    /**
     * Test successful /me request
     */
    async meOk(): Promise<ContractsV1.GetMeResponseV1> {
      return fetchJson<ContractsV1.GetMeResponseV1>({
        path: '/me',
      });
    },

    /**
     * Test 401 unauthorized error
     */
    async me401(): Promise<never> {
      return fetchJson<ContractsV1.GetMeResponseV1>({
        path: '/me',
        query: { error: 'unauthorized' },
      });
    },

    /**
     * Test 403 forbidden error
     */
    async course403(): Promise<never> {
      return fetchJson<ContractsV1.GetCourseResponseV1>({
        path: '/courses/course-1',
        query: { error: 'forbidden' },
      });
    },

    /**
     * Test 500 server error
     */
    async library500(): Promise<never> {
      return fetchJson<ContractsV1.GetLibraryResponseV1>({
        path: '/library',
        query: { error: 'server' },
      });
    },
  };

  // Expose probe on window for console access
  (window as unknown as { __trackedApiProbe?: typeof probe }).__trackedApiProbe = probe;
}
