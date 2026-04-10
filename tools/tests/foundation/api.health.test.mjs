#!/usr/bin/env node

/**
 * Foundation Smoke Test: API Health Endpoint
 * Tests: /health response format, x-request-id header
 *
 * Uses shared api-process so DB-enabled tests get a clean API.
 */

import { test } from 'node:test';
import { buildApi, startApi, stopApi, getApiBaseUrl } from './_utils/api-process.mjs';

const API_URL = getApiBaseUrl();

test.before(async () => {
  await buildApi();
  await startApi({ skipDb: true });
});

test.after(async () => {
  await stopApi();
});

test('GET /health returns 200 with correct format', async () => {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error(`Expected 200, got ${response.status}`);
  }

  const body = await response.json();

  // Check response body structure
  if (!body.ok || typeof body.env !== 'string' || typeof body.version !== 'string') {
    throw new Error(`Invalid health response: ${JSON.stringify(body)}`);
  }

  // Check x-request-id header
  const requestId = response.headers.get('x-request-id');
  if (!requestId || requestId.trim().length === 0) {
    throw new Error('Missing or empty x-request-id header');
  }
});

test('GET /health includes x-request-id header', async () => {
  const response = await fetch(`${API_URL}/health`);

  const requestId = response.headers.get('x-request-id');
  if (!requestId) {
    throw new Error('x-request-id header is missing');
  }

  // Should be a valid UUID or similar format
  if (requestId.trim().length === 0) {
    throw new Error('x-request-id header is empty');
  }
});
