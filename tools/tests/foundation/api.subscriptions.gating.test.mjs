#!/usr/bin/env node

/**
 * Foundation Subscriptions Gating Test (Story 5.3)
 * Expert endpoints: 403 EXPERT_SUBSCRIPTION_INACTIVE when subscription inactive/expired;
 * audit subscription.denied.expert_subscription_inactive with trace_id = x-request-id.
 * Membership deny (EXPERT_MEMBERSHIP_REQUIRED) happens before subscription deny.
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

/** Minimal error response shape (no @tracked/shared in CI). */
function hasErrorCode(body, code) {
  return body && typeof body === 'object' && body.code === code;
}

const dbUrl = process.env.DATABASE_URL;

test.before(async () => {
  if (!dbUrl) {
    console.log('⏭️  Skipping subscription gating tests: DATABASE_URL unset');
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

test('support member, subscription inactive (default) → GET /experts/:expertId/ping = 403 EXPERT_SUBSCRIPTION_INACTIVE', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTg = `tg_gate_admin_${randomUUID().replace(/-/g, '')}`;
  const supportId = randomUUID();
  const supportTg = `tg_gate_sup_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate_sup', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [supportId, supportTg],
  );

  const adminToken = signToken(adminId, adminTg);
  const createRes = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Gating Test', ownerUserId: adminId }),
  });
  if (createRes.status !== 201) {
    const text = await createRes.text();
    await pool.end();
    throw new Error(`Expected 201 from POST /admin/experts, got ${createRes.status}: ${text}`);
  }
  const { id: expertId } = await createRes.json();

  const addRes = await fetch(`${API_URL}/admin/experts/${expertId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: supportId, role: 'support' }),
  });
  if (addRes.status !== 201) {
    await pool.end();
    throw new Error(`Expected 201 from add member, got ${addRes.status}`);
  }
  // Subscription remains default inactive (no grant-days)

  const supportToken = signToken(supportId, supportTg);
  const res = await fetch(`${API_URL}/experts/${expertId}/ping`, {
    headers: { Authorization: `Bearer ${supportToken}` },
  });
  await pool.end();

  if (res.status !== 403) {
    throw new Error(`Expected 403, got ${res.status}`);
  }
  const body = await res.json();
  if (!hasErrorCode(body, 'EXPERT_SUBSCRIPTION_INACTIVE')) {
    throw new Error(`Expected code EXPERT_SUBSCRIPTION_INACTIVE, got ${body.code}`);
  }
});

test('audit: subscription.denied.expert_subscription_inactive by trace_id = x-request-id', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-gate-${randomUUID()}`;

  const adminId = randomUUID();
  const adminTg = `tg_gate2_admin_${randomUUID().replace(/-/g, '')}`;
  const supportId = randomUUID();
  const supportTg = `tg_gate2_sup_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate2_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate2_sup', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [supportId, supportTg],
  );

  const adminToken = signToken(adminId, adminTg);
  const createRes = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Gating Audit Test', ownerUserId: adminId }),
  });
  if (createRes.status !== 201) {
    await pool.end();
    throw new Error(`Expected 201, got ${createRes.status}`);
  }
  const { id: expertId } = await createRes.json();

  await fetch(`${API_URL}/admin/experts/${expertId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: supportId, role: 'support' }),
  });

  const supportToken = signToken(supportId, supportTg);
  await fetch(`${API_URL}/experts/${expertId}/ping`, {
    headers: {
      Authorization: `Bearer ${supportToken}`,
      'x-request-id': traceId,
    },
  });

  const audit = await pool.query(
    `SELECT action, trace_id FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  await pool.end();
  if (audit.rows.length === 0) {
    throw new Error(`Expected audit entry with trace_id=${traceId} (subscription.denied.expert_subscription_inactive).`);
  }
  const denyRow = audit.rows.find((r) => r.action === 'subscription.denied.expert_subscription_inactive');
  if (!denyRow) {
    throw new Error(
      `Expected subscription.denied.expert_subscription_inactive for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
  if (denyRow.trace_id !== traceId) {
    throw new Error(`Audit trace_id ${denyRow.trace_id} !== x-request-id ${traceId}`);
  }
});

test('owner grants days → GET /experts/:expertId/ping = 200', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTg = `tg_gate3_admin_${randomUUID().replace(/-/g, '')}`;
  const ownerId = randomUUID();
  const ownerTg = `tg_gate3_owner_${randomUUID().replace(/-/g, '')}`;
  const supportId = randomUUID();
  const supportTg = `tg_gate3_sup_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate3_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate3_owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate3_sup', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [supportId, supportTg],
  );

  const adminToken = signToken(adminId, adminTg);
  const createRes = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Gating Grant Test', ownerUserId: adminId }),
  });
  if (createRes.status !== 201) {
    await pool.end();
    throw new Error(`Expected 201, got ${createRes.status}`);
  }
  const { id: expertId } = await createRes.json();

  await fetch(`${API_URL}/admin/experts/${expertId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: supportId, role: 'support' }),
  });

  const ownerToken = signToken(ownerId, ownerTg);
  const grantRes = await fetch(`${API_URL}/admin/experts/${expertId}/subscription/grant-days`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days: 30 }),
  });
  if (grantRes.status !== 200) {
    const text = await grantRes.text();
    await pool.end();
    throw new Error(`Expected 200 from grant-days, got ${grantRes.status}: ${text}`);
  }

  const supportToken = signToken(supportId, supportTg);
  const res = await fetch(`${API_URL}/experts/${expertId}/ping`, {
    headers: { Authorization: `Bearer ${supportToken}` },
  });
  await pool.end();

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }
  const body = await res.json();
  if (body.ok !== true || body.expertId !== expertId) {
    throw new Error(`Expected { ok: true, expertId }, got ${JSON.stringify(body)}`);
  }
});

test('owner expire → GET /experts/:expertId/ping = 403 EXPERT_SUBSCRIPTION_INACTIVE', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTg = `tg_gate4_admin_${randomUUID().replace(/-/g, '')}`;
  const ownerId = randomUUID();
  const ownerTg = `tg_gate4_owner_${randomUUID().replace(/-/g, '')}`;
  const supportId = randomUUID();
  const supportTg = `tg_gate4_sup_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate4_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate4_owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate4_sup', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [supportId, supportTg],
  );

  const adminToken = signToken(adminId, adminTg);
  const createRes = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Gating Expire Test', ownerUserId: adminId }),
  });
  if (createRes.status !== 201) {
    await pool.end();
    throw new Error(`Expected 201, got ${createRes.status}`);
  }
  const { id: expertId } = await createRes.json();

  await fetch(`${API_URL}/admin/experts/${expertId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: supportId, role: 'support' }),
  });

  const ownerToken = signToken(ownerId, ownerTg);
  const grantRes = await fetch(`${API_URL}/admin/experts/${expertId}/subscription/grant-days`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days: 30 }),
  });
  if (grantRes.status !== 200) {
    await pool.end();
    throw new Error(`Expected 200 from grant-days, got ${grantRes.status}`);
  }

  const expireRes = await fetch(`${API_URL}/admin/experts/${expertId}/subscription/expire`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  if (expireRes.status !== 200) {
    await pool.end();
    throw new Error(`Expected 200 from expire, got ${expireRes.status}`);
  }

  const supportToken = signToken(supportId, supportTg);
  const res = await fetch(`${API_URL}/experts/${expertId}/ping`, {
    headers: { Authorization: `Bearer ${supportToken}` },
  });
  await pool.end();

  if (res.status !== 403) {
    throw new Error(`Expected 403 after expire, got ${res.status}`);
  }
  const body = await res.json();
  if (!hasErrorCode(body, 'EXPERT_SUBSCRIPTION_INACTIVE')) {
    throw new Error(`Expected code EXPERT_SUBSCRIPTION_INACTIVE, got ${body.code}`);
  }
});

test('user without membership → GET /experts/:expertId/ping = 403 EXPERT_MEMBERSHIP_REQUIRED (membership before subscription)', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTg = `tg_gate5_admin_${randomUUID().replace(/-/g, '')}`;
  const noMemberId = randomUUID();
  const noMemberTg = `tg_gate5_nomem_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate5_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'gate5_nomem', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [noMemberId, noMemberTg],
  );

  const adminToken = signToken(adminId, adminTg);
  const createRes = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Gating NoMember Test', ownerUserId: adminId }),
  });
  if (createRes.status !== 201) {
    await pool.end();
    throw new Error(`Expected 201, got ${createRes.status}`);
  }
  const { id: expertId } = await createRes.json();
  // No grant-days: subscription inactive. No member added: user has no membership.
  // We expect EXPERT_MEMBERSHIP_REQUIRED (ExpertRoleGuard runs before ExpertSubscriptionGuard).

  const noMemberToken = signToken(noMemberId, noMemberTg);
  const res = await fetch(`${API_URL}/experts/${expertId}/ping`, {
    headers: { Authorization: `Bearer ${noMemberToken}` },
  });
  await pool.end();

  if (res.status !== 403) {
    throw new Error(`Expected 403, got ${res.status}`);
  }
  const body = await res.json();
  if (!hasErrorCode(body, 'EXPERT_MEMBERSHIP_REQUIRED')) {
    throw new Error(`Expected code EXPERT_MEMBERSHIP_REQUIRED (membership deny before subscription), got ${body.code}`);
  }
});
