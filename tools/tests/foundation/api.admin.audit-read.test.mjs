#!/usr/bin/env node

/**
 * Foundation Audit Read Test: GET /admin/audit and GET /admin/audit/actions
 * Story 4.4: admin-only, filters, cursor pagination, listActions
 *
 * Skips if DATABASE_URL unset.
 */

import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildApi, startApi, stopApi, getApiBaseUrl } from './_utils/api-process.mjs';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const API_URL = getApiBaseUrl();
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-secret-for-foundation-tests';
const JWT_TTL = 900;

function signToken(userId, telegramUserId) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { sub: userId, tg: telegramUserId, iat: now, exp: now + JWT_TTL },
    JWT_SECRET,
    { algorithm: 'HS256' },
  );
}

const dbUrl = process.env.DATABASE_URL;

test.before(async () => {
  if (!dbUrl) {
    console.log('⏭️  Skipping audit-read tests: DATABASE_URL unset');
    return;
  }
  await buildApi();
  await startApi({
    skipDb: false,
    extraEnv: {
      DATABASE_URL: dbUrl,
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'test-jwt-secret-for-foundation-tests',
    },
  });
});

test.after(async () => {
  await stopApi();
});

test('user → GET /admin/audit returns 403 FORBIDDEN_PLATFORM_ROLE', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const userId = randomUUID();
  const telegramUserId = `tg_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'audit_user', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [userId, telegramUserId],
  );
  await pool.end();

  const token = signToken(userId, telegramUserId);
  const res = await fetch(`${API_URL}/admin/audit?limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status !== 403) {
    throw new Error(`Expected 403, got ${res.status}`);
  }
  const body = await res.json();
  if (body.code !== 'FORBIDDEN_PLATFORM_ROLE') {
    throw new Error(`Expected code FORBIDDEN_PLATFORM_ROLE, got ${body.code}`);
  }
});

test('admin → GET /admin/audit?limit=10 → 200, valid schema', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const userId = randomUUID();
  const telegramUserId = `tg_admin_audit_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin_audit', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [userId, telegramUserId],
  );
  await pool.end();

  const token = signToken(userId, telegramUserId);
  const res = await fetch(`${API_URL}/admin/audit?limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`Expected 200, got ${res.status}: ${text}`);
  }
  const body = await res.json();
  if (!Array.isArray(body.items)) {
    throw new Error(`Expected body.items array, got ${typeof body.items}`);
  }
  for (const item of body.items) {
    if (typeof item.id !== 'string' || typeof item.createdAt !== 'string' || typeof item.action !== 'string') {
      throw new Error(`Invalid item shape: ${JSON.stringify(item)}`);
    }
  }
  if (body.nextCursor !== undefined && typeof body.nextCursor !== 'string') {
    throw new Error(`nextCursor must be string if present, got ${typeof body.nextCursor}`);
  }
});

test('admin → GET /admin/audit?cursor=invalid → 400 VALIDATION_ERROR', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const adminId = randomUUID();
  const adminTgId = `tg_admin_inv_${randomUUID().replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin_inv', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTgId],
  );
  await pool.end();

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/audit?limit=10&cursor=not-valid-base64!!!`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status !== 400) {
    const text = await res.text();
    throw new Error(`Expected 400 for invalid cursor, got ${res.status}: ${text}`);
  }
  const body = await res.json();
  if (body.code !== 'VALIDATION_ERROR') {
    throw new Error(`Expected code VALIDATION_ERROR, got ${body.code}`);
  }
});

// Relies on: platform-role deny always writes audit (Story 4.1/4.3) and trace_id = x-request-id.
test('filter traceId: write audit then GET /admin/audit?traceId=<known>', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;
  const userId = randomUUID();
  const telegramUserId = `tg_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'trace_user', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [userId, telegramUserId],
  );

  await fetch(`${API_URL}/admin/ping`, {
    headers: {
      Authorization: `Bearer ${signToken(userId, telegramUserId)}`,
      'x-request-id': traceId,
    },
  });

  const adminId = randomUUID();
  const adminTgId = `tg_admin_trace_${randomUUID().replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin_trace', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTgId],
  );
  await pool.end();

  const res = await fetch(`${API_URL}/admin/audit?traceId=${encodeURIComponent(traceId)}&limit=50`, {
    headers: { Authorization: `Bearer ${signToken(adminId, adminTgId)}` },
  });

  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`Expected 200, got ${res.status}: ${text}`);
  }
  const body = await res.json();
  const withTrace = body.items.filter((e) => e.traceId === traceId);
  const denyEntry = withTrace.find((e) => e.action === 'rbac.denied.platform_role');
  if (!denyEntry) {
    throw new Error(
      `Expected at least one item with traceId=${traceId} and action rbac.denied.platform_role. Got items: ${JSON.stringify(body.items.slice(0, 3))}`,
    );
  }
});

test('cursor pagination: page1 then page2, no overlap by id', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const adminId = randomUUID();
  const adminTgId = `tg_admin_cursor_${randomUUID().replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin_cursor', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTgId],
  );
  await pool.end();

  const token = signToken(adminId, adminTgId);
  const res1 = await fetch(`${API_URL}/admin/audit?limit=2`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res1.status !== 200) {
    const text = await res1.text();
    throw new Error(`Page1 expected 200, got ${res1.status}: ${text}`);
  }
  const body1 = await res1.json();
  const ids1 = body1.items.map((e) => e.id);

  if (body1.items.length === 0) {
    t.skip('No audit entries to test cursor');
    return;
  }

  if (body1.items.length < 2 && !body1.nextCursor) {
    t.skip('Only one item, no nextCursor to test');
    return;
  }

  if (!body1.nextCursor) {
    t.skip('Less than limit items, no nextCursor');
    return;
  }

  const res2 = await fetch(
    `${API_URL}/admin/audit?limit=2&cursor=${encodeURIComponent(body1.nextCursor)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res2.status !== 200) {
    const text = await res2.text();
    throw new Error(`Page2 expected 200, got ${res2.status}: ${text}`);
  }
  const body2 = await res2.json();
  const ids2 = body2.items.map((e) => e.id);
  const overlap = ids1.filter((id) => ids2.includes(id));
  if (overlap.length > 0) {
    throw new Error(`Cursor pagination overlap: ${overlap.join(', ')}`);
  }
});

test('admin → GET /admin/audit/actions → 200, items includes rbac.denied', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const adminId = randomUUID();
  const adminTgId = `tg_admin_actions_${randomUUID().replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin_actions', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTgId],
  );
  await pool.end();

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/audit/actions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`Expected 200, got ${res.status}: ${text}`);
  }
  const body = await res.json();
  if (!Array.isArray(body.items)) {
    throw new Error(`Expected body.items array, got ${typeof body.items}`);
  }
  const hasRbacDenied = body.items.some((a) => a === 'rbac.denied.platform_role');
  if (!hasRbacDenied) {
    throw new Error(
      `Expected items to include rbac.denied.platform_role (from RBAC tests). Got: ${body.items.slice(0, 10).join(', ')}`,
    );
  }
});
