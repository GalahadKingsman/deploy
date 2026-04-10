/**
 * Token storage utilities
 * Uses localStorage for persistence (v0 implementation)
 */

const STORAGE_KEY = 'tracked.accessToken.v1';

/**
 * Get access token from storage
 * @returns Access token or null if not found
 */
export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // localStorage might be unavailable (e.g., in private browsing)
    console.warn('Failed to read access token from storage:', error);
    return null;
  }
}

/**
 * Set access token in storage
 * @param token - Access token to store
 */
export function setAccessToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch (error) {
    // localStorage might be unavailable or quota exceeded
    console.warn('Failed to store access token:', error);
  }
}

/**
 * Clear access token from storage
 */
export function clearAccessToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // localStorage might be unavailable
    console.warn('Failed to clear access token:', error);
  }
}
