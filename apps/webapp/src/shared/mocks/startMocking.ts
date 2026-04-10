import { config } from '../config/flags.js';
import { supportsMswWorker } from './support.js';
import { createMswWorker } from './browser.js';

/**
 * Mock mode
 */
export type MockMode = 'off' | 'inline' | 'msw-worker' | 'real';

/**
 * Current mock mode (module-level state)
 */
let currentMockMode: MockMode = 'off';

/**
 * Get current mock mode
 */
export function getMockMode(): MockMode {
  return currentMockMode;
}

/**
 * Set mock mode (for testing/debugging)
 */
export function setMockMode(mode: MockMode): void {
  currentMockMode = mode;
}

/**
 * Start mocking based on environment and feature flags
 *
 * Rules:
 * - PROD → always 'off'
 * - REAL_API → 'real'
 * - !USE_MSW → 'off'
 * - USE_MSW + supportsMswWorker() → try 'msw-worker', fallback to 'inline'
 * - USE_MSW + !supportsMswWorker() → 'inline'
 *
 * Never throws - always returns a valid mode
 */
export async function startMocking(): Promise<{ mode: MockMode }> {
  // Production always disables mocking
  if (import.meta.env.PROD) {
    currentMockMode = 'off';
    return { mode: 'off' };
  }

  // REAL_API flag disables mocking
  if (config.REAL_API) {
    currentMockMode = 'real';
    return { mode: 'real' };
  }

  // USE_MSW flag controls mocking
  if (!config.USE_MSW) {
    currentMockMode = 'off';
    return { mode: 'off' };
  }

  // Try Service Worker if supported
  if (supportsMswWorker()) {
    try {
      const worker = createMswWorker();
      // Use BASE_URL to support different base paths (e.g., in production)
      const baseUrl = import.meta.env.BASE_URL || '/';
      const workerUrl = `${baseUrl}mockServiceWorker.js`;
      await worker.start({
        onUnhandledRequest: 'bypass', // Don't block requests if not mocked
        serviceWorker: {
          url: workerUrl,
        },
      });
      currentMockMode = 'msw-worker';
      return { mode: 'msw-worker' };
    } catch (error) {
      // Worker failed to start - fallback to inline
      console.warn('[MSW] Service Worker failed to start, falling back to inline mocking:', error);
      currentMockMode = 'inline';
      return { mode: 'inline' };
    }
  }

  // Service Worker not supported - use inline
  currentMockMode = 'inline';
  return { mode: 'inline' };
}
