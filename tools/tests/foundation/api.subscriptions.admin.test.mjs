#!/usr/bin/env node

/**
 * Foundation Subscriptions Admin Test: grant-days / expire (owner-only), audit
 * Story 5.2: Admin endpoints grant N days / expire for expert_subscriptions (free stub)
 *
 * Skips if DATABASE_URL unset. In CI (.github/workflows/ci.yml) DATABASE_URL is set.
 * Inserts users (owner/admin) and experts directly in DB; no dependency on POST /admin/experts.
 */

import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildApi, startApi, stopApi, getApiBaseUrl } from './_utils/api-process.mjs';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

/** Minimal ExpertSubscriptionV1 shape check (no @tracked/shared in CI node --test context). */
function isValidExpertSubscriptionV1(json) {
  if (!json || typeof json !== 'object') return false;
  if (typeof json.expertId !== 'string' || typeof json.plan !== 'string' || typeof json.status !== 'string')
    return false;
  if (typeof json.priceCents !== 'number') return false;
  if (json.currentPeriodStart !== null && typeof json.currentPeriodStart !== 'string') return false;
  if (json.currentPeriodEnd !== null && typeof json.currentPeriodEnd !== 'string') return false;
  return true;
}

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
    console.log('⏭️  Skipping subscription admin tests: DATABASE_URL unset');
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

test('admin (platform_role=admin) → grant-days → 403 FORBIDDEN_PLATFORM_ROLE', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const ownerUserId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const expertId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTgId],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [ownerUserId, ownerTgId],
  );
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerUserId],
  );
  await pool.query(
    `INSERT INTO expert_subscriptions (expert_id, plan, status, current_period_start, current_period_end, price_cents, created_at, updated_at)
     VALUES ($1, 'free_stub', 'inactive', NULL, NULL, 0, NOW(), NOW())
     ON CONFLICT (expert_id) DO NOTHING`,
    [expertId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/subscription/grant-days`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days: 30 }),
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

test('owner → grant-days days=30 → 200, ExpertSubscriptionV1 schema, DB status=active', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const ownerId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const expertId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTgId],
  );
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerId],
  );
  await pool.query(
    `INSERT INTO expert_subscriptions (expert_id, plan, status, current_period_start, current_period_end, price_cents, created_at, updated_at)
     VALUES ($1, 'free_stub', 'inactive', NULL, NULL, 0, NOW(), NOW())
     ON CONFLICT (expert_id) DO NOTHING`,
    [expertId],
  );

  const token = signToken(ownerId, ownerTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/subscription/grant-days`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days: 30 }),
  });

  if (res.status !== 200) {
    const text = await res.text();
    await pool.end();
    throw new Error(`Expected 200, got ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!isValidExpertSubscriptionV1(json)) {
    await pool.end();
    throw new Error(`Response does not match ExpertSubscriptionV1 shape: ${JSON.stringify(json)}`);
  }

  const subRows = await pool.query(
    `SELECT status, current_period_end FROM expert_subscriptions WHERE expert_id = $1`,
    [expertId],
  );
  await pool.end();

  if (subRows.rows.length === 0) {
    throw new Error('expert_subscriptions row missing after grant-days');
  }
  if (subRows.rows[0].status !== 'active') {
    throw new Error(`Expected status='active', got ${subRows.rows[0].status}`);
  }
  if (subRows.rows[0].current_period_end == null) {
    throw new Error('Expected current_period_end IS NOT NULL after grant-days');
  }
});

test('owner → grant-days twice (10 then 5) → End2 > End1', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const ownerId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const expertId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTgId],
  );
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerId],
  );
  await pool.query(
    `INSERT INTO expert_subscriptions (expert_id, plan, status, current_period_start, current_period_end, price_cents, created_at, updated_at)
     VALUES ($1, 'free_stub', 'inactive', NULL, NULL, 0, NOW(), NOW())
     ON CONFLICT (expert_id) DO NOTHING`,
    [expertId],
  );

  const token = signToken(ownerId, ownerTgId);

  const res1 = await fetch(`${API_URL}/admin/experts/${expertId}/subscription/grant-days`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days: 10 }),
  });
  if (res1.status !== 200) {
    await pool.end();
    throw new Error(`First grant-days expected 200, got ${res1.status}`);
  }
  const body1 = await res1.json();
  const end1 = body1.currentPeriodEnd ? new Date(body1.currentPeriodEnd).getTime() : 0;

  const res2 = await fetch(`${API_URL}/admin/experts/${expertId}/subscription/grant-days`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days: 5 }),
  });
  if (res2.status !== 200) {
    await pool.end();
    throw new Error(`Second grant-days expected 200, got ${res2.status}`);
  }
  const body2 = await res2.json();
  const end2 = body2.currentPeriodEnd ? new Date(body2.currentPeriodEnd).getTime() : 0;

  await pool.end();

  if (end2 <= end1) {
    throw new Error(`Expected End2 > End1 (${end2} > ${end1})`);
  }
});

test('owner → expire → 200, DB status=expired', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const ownerId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const expertId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTgId],
  );
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerId],
  );
  await pool.query(
    `INSERT INTO expert_subscriptions (expert_id, plan, status, current_period_start, current_period_end, price_cents, created_at, updated_at)
     VALUES ($1, 'free_stub', 'active', NOW(), NOW() + interval '30 days', 0, NOW(), NOW())
     ON CONFLICT (expert_id) DO NOTHING`,
    [expertId],
  );

  const token = signToken(ownerId, ownerTgId);
  const beforeMs = Date.now();
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/subscription/expire`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const afterMs = Date.now();

  if (res.status !== 200) {
    const text = await res.text();
    await pool.end();
    throw new Error(`Expected 200, got ${res.status}: ${text}`);
  }

  const subRows = await pool.query(
    `SELECT status, current_period_end FROM expert_subscriptions WHERE expert_id = $1`,
    [expertId],
  );
  await pool.end();

  if (subRows.rows.length === 0) {
    throw new Error('expert_subscriptions row missing after expire');
  }
  if (subRows.rows[0].status !== 'expired') {
    throw new Error(`Expected status='expired', got ${subRows.rows[0].status}`);
  }
  const endDate = subRows.rows[0].current_period_end;
  if (!endDate) {
    throw new Error('Expected current_period_end set after expire');
  }
  const endMs = new Date(endDate).getTime();
  if (endMs < beforeMs - 5000 || endMs > afterMs + 5000) {
    throw new Error(`current_period_end should be close to now (got ${endDate})`);
  }
});

test('invalid days: days=0 → 400 VALIDATION_ERROR', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const ownerId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const expertId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTgId],
  );
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerId],
  );
  await pool.query(
    `INSERT INTO expert_subscriptions (expert_id, plan, status, current_period_start, current_period_end, price_cents, created_at, updated_at)
     VALUES ($1, 'free_stub', 'inactive', NULL, NULL, 0, NOW(), NOW())
     ON CONFLICT (expert_id) DO NOTHING`,
    [expertId],
  );

  const token = signToken(ownerId, ownerTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/subscription/grant-days`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days: 0 }),
  });

  await pool.end();

  if (res.status !== 400) {
    throw new Error(`Expected 400, got ${res.status}`);
  }
  const body = await res.json();
  if (body.code !== 'VALIDATION_ERROR') {
    throw new Error(`Expected code VALIDATION_ERROR, got ${body.code}`);
  }
});

test('expert not found: owner → grant-days on random UUID → 404 EXPERT_NOT_FOUND', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const ownerId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const fakeExpertId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTgId],
  );

  const token = signToken(ownerId, ownerTgId);
  const res = await fetch(`${API_URL}/admin/experts/${fakeExpertId}/subscription/grant-days`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days: 30 }),
  });

  await pool.end();

  if (res.status !== 404) {
    throw new Error(`Expected 404, got ${res.status}`);
  }
  const body = await res.json();
  if (body.code !== 'EXPERT_NOT_FOUND') {
    throw new Error(`Expected code EXPERT_NOT_FOUND, got ${body.code}`);
  }
});

test('audit: grant-days writes admin.expert_subscription.grant_days with trace_id = x-request-id', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;
  const ownerId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const expertId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTgId],
  );
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerId],
  );
  await pool.query(
    `INSERT INTO expert_subscriptions (expert_id, plan, status, current_period_start, current_period_end, price_cents, created_at, updated_at)
     VALUES ($1, 'free_stub', 'inactive', NULL, NULL, 0, NOW(), NOW())
     ON CONFLICT (expert_id) DO NOTHING`,
    [expertId],
  );

  const token = signToken(ownerId, ownerTgId);
  await fetch(`${API_URL}/admin/experts/${expertId}/subscription/grant-days`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-request-id': traceId,
    },
    body: JSON.stringify({ days: 7 }),
  });

  const audit = await pool.query(
    `SELECT action FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  await pool.end();

  const grantEntry = audit.rows.find((r) => r.action === 'admin.expert_subscription.grant_days');
  if (!grantEntry) {
    throw new Error(
      `Expected admin.expert_subscription.grant_days for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
});

test('audit: expire writes admin.expert_subscription.expire with trace_id = x-request-id', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;
  const ownerId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const expertId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTgId],
  );
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerId],
  );
  await pool.query(
    `INSERT INTO expert_subscriptions (expert_id, plan, status, current_period_start, current_period_end, price_cents, created_at, updated_at)
     VALUES ($1, 'free_stub', 'inactive', NULL, NULL, 0, NOW(), NOW())
     ON CONFLICT (expert_id) DO NOTHING`,
    [expertId],
  );

  const token = signToken(ownerId, ownerTgId);
  await fetch(`${API_URL}/admin/experts/${expertId}/subscription/expire`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-request-id': traceId,
    },
  });

  const audit = await pool.query(
    `SELECT action FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  await pool.end();

  const expireEntry = audit.rows.find((r) => r.action === 'admin.expert_subscription.expire');
  if (!expireEntry) {
    throw new Error(
      `Expected admin.expert_subscription.expire for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
});
