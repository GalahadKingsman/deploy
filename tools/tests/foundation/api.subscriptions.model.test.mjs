#!/usr/bin/env node

/**
 * Foundation Subscriptions Test: expert_subscriptions table, migration 006, default row on expert create
 * Story 5.1: Subscription model (free stub) + default row on expert create
 *
 * Skips if DATABASE_URL unset. In CI (.github/workflows/ci.yml) DATABASE_URL is set, so this suite runs.
 * Does not duplicate RBAC/experts applied_migrations checks (those assert 003/004; this asserts 006_*).
 * Requires: applied_migrations 006, expert_subscriptions table; POST /admin/experts creates default subscription.
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
    console.log('⏭️  Skipping subscriptions tests: DATABASE_URL unset');
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

test('applied_migrations has 006_* after API start', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const { rows } = await pool.query(
    `SELECT name FROM applied_migrations WHERE name LIKE '006_%' ORDER BY name`,
  );
  await pool.end();

  if (rows.length === 0) {
    throw new Error(
      'Expected applied_migrations to contain 006_* (e.g. 006_add_expert_subscriptions). ' +
        'API must run migrations eagerly on start. API and test must use same DATABASE_URL.',
    );
  }
});

test('admin creates expert → expert_subscriptions row exists with defaults', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const ownerUserId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;

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

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Expert With Default Subscription', ownerUserId }),
  });

  if (res.status !== 201) {
    const text = await res.text();
    await pool.end();
    throw new Error(`Expected 201, got ${res.status}: ${text}`);
  }

  const body = await res.json();
  if (!body.id || typeof body.id !== 'string') {
    await pool.end();
    throw new Error(`Expected { id: string }, got ${JSON.stringify(body)}`);
  }

  const expertId = body.id;

  const subRows = await pool.query(
    `SELECT plan, status, price_cents, current_period_start, current_period_end FROM expert_subscriptions WHERE expert_id = $1`,
    [expertId],
  );
  await pool.end();

  if (subRows.rows.length === 0) {
    throw new Error(
      'Expected expert_subscriptions row for new expert. ensureDefault must run after expert create.',
    );
  }

  const row = subRows.rows[0];
  if (row.plan !== 'free_stub') {
    throw new Error(`Expected plan='free_stub', got ${row.plan}`);
  }
  if (row.status !== 'inactive') {
    throw new Error(`Expected status='inactive', got ${row.status}`);
  }
  if (Number(row.price_cents) !== 0) {
    throw new Error(`Expected price_cents=0, got ${row.price_cents}`);
  }
  if (row.current_period_start != null) {
    throw new Error(`Expected current_period_start IS NULL, got ${row.current_period_start}`);
  }
  if (row.current_period_end != null) {
    throw new Error(`Expected current_period_end IS NULL, got ${row.current_period_end}`);
  }
});
