import { setupWorker } from 'msw/browser';
import { handlers } from './handlers.js';

/**
 * MSW Service Worker setup for browser
 * Only use when Service Worker is supported
 */
export function createMswWorker() {
  return setupWorker(...handlers);
}
