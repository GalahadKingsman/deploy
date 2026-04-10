#!/usr/bin/env node

/**
 * Foundation Smoke Test: Swagger Documentation
 * Tests: /docs available in dev, 404 in production
 */

import { test } from 'node:test';
import { buildApi, startApi, stopApi, getApiBaseUrl } from './_utils/api-process.mjs';

const API_URL = getApiBaseUrl();

test('GET /docs returns 200 in development mode', async () => {
  await buildApi();
  await startApi({ nodeEnv: 'development', skipDb: true, swaggerEnabled: true });
  
  try {
    // Request /docs without following redirects (Swagger UI may redirect /docs -> /docs/; we want 200 for /docs)
    const response = await fetch(`${API_URL}/docs`, { redirect: 'manual' });
    
    if (response.status !== 200) {
      const body = await response.text();
      throw new Error(`Expected 200, got ${response.status}. Response: ${body.substring(0, 200)}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error(`Expected text/html, got ${contentType}`);
    }
  } finally {
    await stopApi();
  }
});

test('GET /docs returns 404 with error format in production mode', async () => {
  // Ensure previous API process is fully stopped
  await stopApi();
  // Wait longer to ensure process and port are fully released
  await new Promise((resolve) => setTimeout(resolve, 3000));
  
  await buildApi();
  await startApi({ nodeEnv: 'production', skipDb: true, swaggerEnabled: false });
  
  try {
    const response = await fetch(`${API_URL}/docs`);
    
    if (response.status !== 404) {
      throw new Error(`Expected 404, got ${response.status}`);
    }

    const body = await response.json();
    
    // Regression test: Check unified error format (mandatory contract)
    // This ensures the error format is consistent and not accidentally broken
    if (!body.statusCode || !body.code || !body.message || !body.requestId) {
      throw new Error(`Invalid error response format: ${JSON.stringify(body)}`);
    }

    if (body.statusCode !== 404) {
      throw new Error(`Expected statusCode 404, got ${body.statusCode}`);
    }

    if (body.code !== 'NOT_FOUND') {
      throw new Error(`Expected code NOT_FOUND, got ${body.code}`);
    }

    // Verify message is a string (unified error format requirement)
    if (typeof body.message !== 'string' || body.message.length === 0) {
      throw new Error(`Expected non-empty string message, got: ${typeof body.message}`);
    }

    // Verify requestId is a string (unified error format requirement)
    if (typeof body.requestId !== 'string' || body.requestId.length === 0) {
      throw new Error(`Expected non-empty string requestId, got: ${typeof body.requestId}`);
    }

    // Check x-request-id header matches body.requestId
    const requestId = response.headers.get('x-request-id');
    if (!requestId) {
      throw new Error('Missing x-request-id header');
    }
    if (requestId !== body.requestId) {
      throw new Error(`x-request-id header (${requestId}) does not match body.requestId (${body.requestId})`);
    }
  } finally {
    await stopApi();
  }
});

test('SWAGGER_ENABLED parsing: "0" and "false" are falsy', async () => {
  await stopApi();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  await buildApi();
  
  // Test with SWAGGER_ENABLED=0 (string)
  await startApi({ 
    nodeEnv: 'development', 
    skipDb: true, 
    swaggerEnabled: false,
    extraEnv: { SWAGGER_ENABLED: '0' }
  });
  
  try {
    const response = await fetch(`${API_URL}/docs`);
    if (response.status !== 404) {
      throw new Error(`Expected 404 when SWAGGER_ENABLED=0, got ${response.status}`);
    }
  } finally {
    await stopApi();
  }
  
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  // Test with SWAGGER_ENABLED=false (string)
  await startApi({ 
    nodeEnv: 'development', 
    skipDb: true, 
    swaggerEnabled: false,
    extraEnv: { SWAGGER_ENABLED: 'false' }
  });
  
  try {
    const response = await fetch(`${API_URL}/docs`);
    if (response.status !== 404) {
      throw new Error(`Expected 404 when SWAGGER_ENABLED=false, got ${response.status}`);
    }
  } finally {
    await stopApi();
  }
});

test('SWAGGER_ENABLED parsing: "1" and "true" are truthy', async () => {
  await stopApi();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  await buildApi();
  
  // Test with SWAGGER_ENABLED=1 (string)
  await startApi({ 
    nodeEnv: 'development', 
    skipDb: true, 
    swaggerEnabled: true,
    extraEnv: { SWAGGER_ENABLED: '1' }
  });
  
  try {
    const response = await fetch(`${API_URL}/docs`);
    if (response.status !== 200) {
      throw new Error(`Expected 200 when SWAGGER_ENABLED=1, got ${response.status}`);
    }
  } finally {
    await stopApi();
  }
  
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  // Test with SWAGGER_ENABLED=true (string)
  await startApi({ 
    nodeEnv: 'development', 
    skipDb: true, 
    swaggerEnabled: true,
    extraEnv: { SWAGGER_ENABLED: 'true' }
  });
  
  try {
    const response = await fetch(`${API_URL}/docs`);
    if (response.status !== 200) {
      throw new Error(`Expected 200 when SWAGGER_ENABLED=true, got ${response.status}`);
    }
  } finally {
    await stopApi();
  }
});
