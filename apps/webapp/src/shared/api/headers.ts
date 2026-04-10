import { getAccessToken } from '../auth/tokenStorage.js';

/**
 * Request headers utilities
 */

/**
 * Generate a unique request ID
 */
export function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get authentication headers
 * @returns Authorization header with Bearer token if available, otherwise empty object
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = getAccessToken();
  if (!token) {
    return {};
  }

  return {
    authorization: `Bearer ${token}`,
  };
}
