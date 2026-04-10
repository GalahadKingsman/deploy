import { ContractsV1 } from '@tracked/shared';
import { buildUrl } from './url.js';
import { createRequestId, getAuthHeaders } from './headers.js';
import { ApiClientError, mapHttpStatusToErrorCode } from './errors.js';
import { config } from '../config/flags.js';
import { getMockMode } from '../mocks/startMocking.js';
import { tryHandleMockRequest } from '../mocks/inline.js';

/**
 * Options for fetchJson
 */
export interface FetchJsonOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Fetch JSON with unified error handling
 *
 * @template T - Expected response type
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws {ApiClientError} On non-2xx responses
 */
export async function fetchJson<T = unknown>(options: FetchJsonOptions): Promise<T> {
  const { path, method = 'GET', query, body, headers: customHeaders = {}, signal } = options;

  const requestId = createRequestId();

  // Try inline mocking if enabled
  const mockMode = getMockMode();
  if (mockMode === 'inline') {
    // Convert query to Record<string, string>
    const queryString: Record<string, string> = {};
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          queryString[key] = String(value);
        }
      }
    }

    const mockResponse = tryHandleMockRequest({
      method,
      path,
      query: queryString,
      body,
    });

    if (mockResponse) {
      // Handle mock response as if it came from fetch
      const mockStatus = mockResponse.status;
      const mockJson = mockResponse.json;

      // Handle success (2xx)
      if (mockStatus >= 200 && mockStatus < 300) {
        return mockJson as T;
      }

      // Handle error (non-2xx) - parse as unified error format
      const parsed = ContractsV1.ApiErrorResponseV1Schema.safeParse(mockJson);
      if (parsed.success && parsed.data.error) {
        const error = parsed.data.error;
        throw new ApiClientError(
          mockStatus,
          error.code,
          error.message,
          error.requestId || requestId,
          error.details,
        );
      }

      // Fallback error
      const code = mapHttpStatusToErrorCode(mockStatus);
      throw new ApiClientError(mockStatus, code, 'Request failed', requestId);
    }
    // If mock returned null, fall through to real fetch
  }

  // Real API fetch (or fallback from inline mock)
  // When API_BASE_URL is empty in browser, use same origin (Vite proxy forwards /auth, /me, /health)
  const baseUrl =
    config.API_BASE_URL || (typeof window !== 'undefined' ? (window.location?.origin ?? '') : '');
  if (!baseUrl) {
    throw new ApiClientError(0, 'CONFIG_ERROR', 'VITE_API_BASE_URL is not configured', requestId);
  }

  const url = buildUrl(baseUrl, path, query);

  // Build headers
  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-request-id': requestId,
    ...customHeaders,
  };

  // Skip ngrok browser warning when Mini App is opened via ngrok (otherwise requests get interstitial page)
  if (baseUrl.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  // Add content-type only if body is present
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  // Add auth headers (stub for EPIC 3)
  const authHeaders = await getAuthHeaders();
  Object.assign(headers, authHeaders);

  // Prepare fetch options
  const fetchOptions: RequestInit = {
    method,
    headers,
    signal,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  // Execute fetch
  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    // Network error or abort
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network request failed',
      requestId,
      undefined,
      error,
    );
  }

  // Handle success (2xx)
  if (response.ok) {
    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    // Parse JSON response
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        const json = await response.json();
        return json as T;
      } catch (error) {
        throw new ApiClientError(
          response.status,
          'PARSE_ERROR',
          'Failed to parse JSON response',
          requestId,
          undefined,
          error,
        );
      }
    }

    // SPA/nginx often returns text/html when requests go to the web host instead of the API
    if (contentType.includes('text/html')) {
      throw new ApiClientError(
        response.status,
        'INVALID_RESPONSE',
        'Сервер вернул HTML вместо JSON. Для production укажите VITE_API_BASE_URL=https://api.<домен> и пересоберите webapp.',
        requestId,
      );
    }

    // Other non-JSON 2xx (rare for this app)
    return undefined as T;
  }

  // Handle error (non-2xx)
  const responseRequestId = response.headers.get('x-request-id') || requestId;

  // Try to parse error response as unified format
  const contentType = response.headers.get('content-type');
  let errorBody: unknown = undefined;
  if (contentType?.includes('application/json')) {
    try {
      errorBody = await response.json();
      const parsed = ContractsV1.ApiErrorResponseV1Schema.safeParse(errorBody);

      if (parsed.success && parsed.data.error) {
        const error = parsed.data.error;
        throw new ApiClientError(
          response.status,
          error.code,
          error.message,
          error.requestId || responseRequestId,
          error.details,
        );
      }

      // API may return flat format { statusCode, code, message, requestId } (Nest ApiExceptionFilter)
      if (
        errorBody &&
        typeof errorBody === 'object' &&
        'message' in errorBody &&
        typeof (errorBody as { message?: unknown }).message === 'string'
      ) {
        const flat = errorBody as { code?: string; message: string; requestId?: string };
        throw new ApiClientError(
          response.status,
          flat.code ?? mapHttpStatusToErrorCode(response.status),
          flat.message,
          flat.requestId ?? responseRequestId,
        );
      }
    } catch (error) {
      // If it's already ApiClientError, re-throw
      if (error instanceof ApiClientError) {
        throw error;
      }
      // If JSON parse failed, fall through to fallback
    }
  }

  // Fallback: create error from status code
  const code = mapHttpStatusToErrorCode(response.status);
  let message = 'Request failed';
  if (
    errorBody &&
    typeof errorBody === 'object' &&
    'message' in errorBody &&
    typeof (errorBody as { message?: unknown }).message === 'string'
  ) {
    message = (errorBody as { message: string }).message;
  }

  throw new ApiClientError(response.status, code, message, responseRequestId);
}
