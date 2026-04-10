#!/usr/bin/env node

/**
 * Foundation RBAC Test: Platform roles
 * Story 4.1: user → /admin/ping = 403, admin → /admin/ping = 200,
 * owner → set role, admin → set role = 403, audit entries
 *
 * Skips if DATABASE_URL unset.
 * Requires: applied_migrations, platform_role column, migrations applied.
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
    console.log('⏭️  Skipping RBAC tests: DATABASE_URL unset');
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

test('applied_migrations has 003_* and 004_* after API start', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const { rows } = await pool.query(
    `SELECT name FROM applied_migrations WHERE name IN ('003_add_applied_migrations_and_platform_roles', '004_add_experts_and_members') ORDER BY name`,
  );
  await pool.end();

  const names = rows.map((r) => r.name);
  if (!names.includes('003_add_applied_migrations_and_platform_roles')) {
    throw new Error(
      'Expected applied_migrations to contain 003_add_applied_migrations_and_platform_roles. ' +
        'API must run migrations eagerly on start. API and test must use same DATABASE_URL.',
    );
  }
  if (!names.includes('004_add_experts_and_members')) {
    throw new Error(
      'Expected applied_migrations to contain 004_add_experts_and_members. ' +
        'API must run migrations eagerly on start. API and test must use same DATABASE_URL.',
    );
  }
});

test('user → GET /admin/ping returns 403 FORBIDDEN_PLATFORM_ROLE', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  const userId = randomUUID();
  const telegramUserId = `tg_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'testuser', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [userId, telegramUserId],
  );

  const token = signToken(userId, telegramUserId);
  const res = await fetch(`${API_URL}/admin/ping`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-request-id': `trace-${randomUUID()}`,
    },
  });

  await pool.end();

  if (res.status !== 403) {
    throw new Error(`Expected 403, got ${res.status}`);
  }

  const body = await res.json();
  if (body.code !== 'FORBIDDEN_PLATFORM_ROLE') {
    throw new Error(`Expected code FORBIDDEN_PLATFORM_ROLE, got ${body.code}`);
  }

  const requestId = res.headers.get('x-request-id');
  if (!requestId) {
    throw new Error('Missing x-request-id header');
  }
  if (body.requestId !== requestId) {
    throw new Error(`requestId (${body.requestId}) does not match x-request-id (${requestId})`);
  }
});

test('audit rbac.denied.platform_role with trace_id = x-request-id', async (t) => {
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
     VALUES ($1, $2, 'testuser2', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [userId, telegramUserId],
  );

  const token = signToken(userId, telegramUserId);
  await fetch(`${API_URL}/admin/ping`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-request-id': traceId,
    },
  });

  const audit = await pool.query(
    `SELECT action, trace_id, meta FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  await pool.end();

  if (audit.rows.length === 0) {
    throw new Error(
      `Expected audit entry with trace_id=${traceId} (rbac.denied.platform_role). API and test must use same DATABASE_URL.`,
    );
  }
  const denyEntry = audit.rows.find((r) => r.action === 'rbac.denied.platform_role');
  if (!denyEntry) {
    throw new Error(
      `Expected rbac.denied.platform_role for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
});

test('admin → GET /admin/ping returns 200 { ok: true }', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  const userId = randomUUID();
  const telegramUserId = `tg_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'adminuser', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [userId, telegramUserId],
  );

  const token = signToken(userId, telegramUserId);
  const res = await fetch(`${API_URL}/admin/ping`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await pool.end();

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  const body = await res.json();
  if (body.ok !== true) {
    throw new Error(`Expected { ok: true }, got ${JSON.stringify(body)}`);
  }
});

test('owner → POST /admin/users/:id/platform-role sets target to admin + audit', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;

  const ownerId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const targetId = randomUUID();
  const targetTgId = `tg_target_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTgId],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'target', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [targetId, targetTgId],
  );

  const token = signToken(ownerId, ownerTgId);
  const res = await fetch(`${API_URL}/admin/users/${targetId}/platform-role`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-request-id': traceId,
    },
    body: JSON.stringify({ role: 'admin' }),
  });

  if (res.status !== 200 && res.status !== 201) {
    const text = await res.text();
    throw new Error(`Expected 200 or 201, got ${res.status}: ${text}`);
  }

  const row = await pool.query(
    `SELECT platform_role FROM users WHERE id = $1`,
    [targetId],
  );
  if (row.rows[0].platform_role !== 'admin') {
    throw new Error(`Expected platform_role=admin, got ${row.rows[0].platform_role}`);
  }

  const audit = await pool.query(
    `SELECT action, entity_id, meta FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  await pool.end();

  if (audit.rows.length === 0) {
    throw new Error(
      `Expected audit entry admin.user.platform_role.set with trace_id=${traceId}. API and test must use same DATABASE_URL.`,
    );
  }
  const setEntry = audit.rows.find((r) => r.action === 'admin.user.platform_role.set');
  if (!setEntry) {
    throw new Error(
      `Expected admin.user.platform_role.set for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
  if (setEntry.entity_id !== targetId) {
    throw new Error(`Expected entity_id ${targetId}, got ${setEntry.entity_id}`);
  }
  const meta = setEntry.meta;
  if (meta?.to !== 'admin') {
    throw new Error(`Expected meta.to=admin, got ${JSON.stringify(meta)}`);
  }
});

test('admin → POST /admin/users/:id/platform-role returns 403 FORBIDDEN_PLATFORM_ROLE', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const targetId = randomUUID();
  const targetTgId = `tg_target2_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin2', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTgId],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'target2', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [targetId, targetTgId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/users/${targetId}/platform-role`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'moderator' }),
  });

  await pool.end();

  if (res.status !== 403) {
    throw new Error(`Expected 403, got ${res.status}`);
  }

  const body = await res.json();
  if (body.code !== 'FORBIDDEN_PLATFORM_ROLE') {
    throw new Error(`Expected code FORBIDDEN_PLATFORM_ROLE, got ${body.code}`);
  }
});
