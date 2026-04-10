/**
 * MSW support detection
 */

/**
 * Check if MSW Service Worker is supported in current environment
 *
 * Requirements:
 * - Development mode (not production)
 * - Service Worker API available in navigator
 * - Secure context (HTTPS) or localhost
 */
export function supportsMswWorker(): boolean {
  // Production always returns false
  if (import.meta.env.PROD) {
    return false;
  }

  // Check for Service Worker API
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  // Check for secure context (HTTPS or localhost)
  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    return false;
  }

  return true;
}
