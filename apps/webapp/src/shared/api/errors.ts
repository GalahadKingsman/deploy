/**
 * API Client Error
 */

/**
 * API Client Error type
 */
export class ApiClientError extends Error {
  readonly name = 'ApiClientError';
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details?: unknown;
  readonly cause?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string,
    details?: unknown,
    cause?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.cause = cause;
    Error.captureStackTrace?.(this, ApiClientError);
  }
}

/**
 * Type guard for ApiClientError
 */
export function isApiClientError(error: unknown): error is ApiClientError {
  return (
    error instanceof ApiClientError ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'ApiClientError' &&
      'status' in error &&
      'code' in error &&
      'requestId' in error)
  );
}

/**
 * Extract HTTP status from an error (Story 5.4).
 * Handles ApiClientError.status, response?.status, cause?.status, and generic .status.
 */
export function getHttpStatus(err: unknown): number | null {
  if (err == null) return null;
  if (isApiClientError(err)) return err.status;
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.status === 'number') return o.status;
    const res = o.response as Record<string, unknown> | undefined;
    if (res && typeof res.status === 'number') return res.status;
    const data = o.data as Record<string, unknown> | undefined;
    if (data && typeof data.status === 'number') return data.status;
    if (o.cause != null) return getHttpStatus(o.cause);
  }
  return null;
}

/**
 * Map HTTP status code to error code
 * Uses existing error codes from @tracked/shared
 */
export function mapHttpStatusToErrorCode(status: number): string {
  if (status >= 400 && status < 500) {
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 422) return 'VALIDATION_ERROR';
    if (status === 429) return 'RATE_LIMITED';
    return 'VALIDATION_ERROR'; // Fallback for other 4xx
  }

  if (status >= 500) {
    return 'INTERNAL_ERROR';
  }

  // Fallback for unknown status codes
  return 'UNKNOWN';
}
