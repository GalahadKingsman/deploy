#!/usr/bin/env node

/**
 * Foundation Smoke Test: API Error Format
 * Tests: 404 error format, 400 validation error format, requestId consistency
 *
 * Uses shared api-process so DB-enabled tests (experts, rbac) get a clean API
 * after this suite stops.
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

test('GET /nope returns 404 with unified error format', async () => {
  const response = await fetch(`${API_URL}/nope`);

  if (response.status !== 404) {
    throw new Error(`Expected 404, got ${response.status}`);
  }

  const body = await response.json();

  // Check unified error format
  if (!body.statusCode || !body.code || !body.message || !body.requestId) {
    throw new Error(`Invalid error response format: ${JSON.stringify(body)}`);
  }

  if (body.statusCode !== 404) {
    throw new Error(`Expected statusCode 404, got ${body.statusCode}`);
  }

  if (body.code !== 'NOT_FOUND') {
    throw new Error(`Expected code NOT_FOUND, got ${body.code}`);
  }

  // Check x-request-id header
  const requestId = response.headers.get('x-request-id');
  if (!requestId) {
    throw new Error('Missing x-request-id header');
  }

  // requestId should match x-request-id
  if (body.requestId !== requestId) {
    throw new Error(`requestId (${body.requestId}) does not match x-request-id (${requestId})`);
  }
});

test('GET /health/400 returns 400 with validation error format', async () => {
  const response = await fetch(`${API_URL}/health/400`);

  if (response.status !== 400) {
    throw new Error(`Expected 400, got ${response.status}`);
  }

  const body = await response.json();

  // Check unified error format
  if (!body.statusCode || !body.code || !body.message || !body.requestId) {
    throw new Error(`Invalid error response format: ${JSON.stringify(body)}`);
  }

  if (body.statusCode !== 400) {
    throw new Error(`Expected statusCode 400, got ${body.statusCode}`);
  }

  if (body.code !== 'VALIDATION_ERROR') {
    throw new Error(`Expected code VALIDATION_ERROR, got ${body.code}`);
  }

  // Check details array for validation errors
  if (!Array.isArray(body.details)) {
    throw new Error(`Expected details array, got ${typeof body.details}`);
  }

  // Check x-request-id header
  const requestId = response.headers.get('x-request-id');
  if (!requestId) {
    throw new Error('Missing x-request-id header');
  }

  // requestId should match x-request-id
  if (body.requestId !== requestId) {
    throw new Error(`requestId (${body.requestId}) does not match x-request-id (${requestId})`);
  }
});
