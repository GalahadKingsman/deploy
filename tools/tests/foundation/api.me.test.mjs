#!/usr/bin/env node

/**
 * Foundation Smoke Test: API /me Endpoint
 * Tests: 401 error format for missing/invalid auth, unified error format
 * 
 * This test is deterministic: it builds and starts the API itself,
 * waits for the port to be available, and cleans up after itself.
 * No DB required: SKIP_DB=1 remains.
 */

import { test } from 'node:test';
import { buildApi, startApi, stopApi, getApiBaseUrl } from './_utils/api-process.mjs';

const API_URL = getApiBaseUrl();

test.before(async () => {
  // Build API first to ensure it's ready
  await buildApi();
  // Start API and wait for it to be ready
  await startApi();
});

test.after(async () => {
  await stopApi();
});

test('GET /me without auth returns 401 with unified error format', async () => {
  const response = await fetch(`${API_URL}/me`);
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }

  const body = await response.json();
  
  // Check unified error format
  if (!body.statusCode || !body.code || !body.message || !body.requestId) {
    throw new Error(`Invalid error response format: ${JSON.stringify(body)}`);
  }

  if (body.statusCode !== 401) {
    throw new Error(`Expected statusCode 401, got ${body.statusCode}`);
  }

  if (body.code !== 'UNAUTHORIZED') {
    throw new Error(`Expected code UNAUTHORIZED, got ${body.code}`);
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

test('GET /me with invalid token returns 401 unified error (NOT 500)', async () => {
  const response = await fetch(`${API_URL}/me`, {
    headers: {
      'Authorization': 'Bearer clearly-invalid-token-here',
    },
  });
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status} (should NOT be 500)`);
  }

  const body = await response.json();
  
  // Check unified error format
  if (!body.statusCode || !body.code || !body.message || !body.requestId) {
    throw new Error(`Invalid error response format: ${JSON.stringify(body)}`);
  }

  if (body.statusCode !== 401) {
    throw new Error(`Expected statusCode 401, got ${body.statusCode}`);
  }

  if (body.code !== 'UNAUTHORIZED') {
    throw new Error(`Expected code UNAUTHORIZED, got ${body.code}`);
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
