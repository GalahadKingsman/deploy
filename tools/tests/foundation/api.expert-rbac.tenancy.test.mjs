#!/usr/bin/env node

/**
 * Foundation Expert RBAC & Tenancy Test (Story 4.3)
 * Expert endpoints: membership required, role required, audit deny with trace_id.
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
    console.log('⏭️  Skipping Expert RBAC tests: DATABASE_URL unset');
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

test('applied_migrations contains 004', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });
  const { rows } = await pool.query(
    `SELECT name FROM applied_migrations WHERE name = '004_add_experts_and_members'`,
  );
  await pool.end();
  if (rows.length === 0) {
    throw new Error(
      'Expected applied_migrations to contain 004_add_experts_and_members. API and test must use same DATABASE_URL.',
    );
  }
});

test('user without membership → GET /experts/:expertId/ping = 403 EXPERT_MEMBERSHIP_REQUIRED + audit rbac.denied.expert_membership trace_id', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;

  const adminId = randomUUID();
  const adminTg = `tg_erbac_admin_${randomUUID().replace(/-/g, '')}`;
  const noMemberId = randomUUID();
  const noMemberTg = `tg_erbac_nomem_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac_nomem', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [noMemberId, noMemberTg],
  );

  const adminToken = signToken(adminId, adminTg);
  const createRes = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      'x-request-id': `trace-create-${randomUUID()}`,
    },
    body: JSON.stringify({ title: 'Expert RBAC Test', ownerUserId: adminId }),
  });
  if (createRes.status !== 201) {
    const text = await createRes.text();
    await pool.end();
    throw new Error(`Expected 201 from POST /admin/experts, got ${createRes.status}: ${text}`);
  }
  const { id: expertId } = await createRes.json();

  const noMemberToken = signToken(noMemberId, noMemberTg);
  const res = await fetch(`${API_URL}/experts/${expertId}/ping`, {
    headers: {
      Authorization: `Bearer ${noMemberToken}`,
      'x-request-id': traceId,
    },
  });

  if (res.status !== 403) {
    await pool.end();
    throw new Error(`Expected 403, got ${res.status}`);
  }
  const body = await res.json();
  if (body.code !== 'EXPERT_MEMBERSHIP_REQUIRED') {
    await pool.end();
    throw new Error(`Expected code EXPERT_MEMBERSHIP_REQUIRED, got ${body.code}`);
  }
  const requestId = res.headers.get('x-request-id');
  if (body.requestId !== requestId) {
    await pool.end();
    throw new Error(`requestId (${body.requestId}) does not match x-request-id (${requestId})`);
  }

  const audit = await pool.query(
    `SELECT action, trace_id FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  await pool.end();
  if (audit.rows.length === 0) {
    throw new Error(`Expected audit entry with trace_id=${traceId} (rbac.denied.expert_membership).`);
  }
  const denyRow = audit.rows.find((r) => r.action === 'rbac.denied.expert_membership');
  if (!denyRow) {
    throw new Error(
      `Expected rbac.denied.expert_membership for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
  if (denyRow.trace_id !== traceId) {
    throw new Error(`Audit trace_id ${denyRow.trace_id} !== request trace_id ${traceId}`);
  }
});

test('support member → GET /experts/:expertId/ping = 200', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTg = `tg_erbac2_admin_${randomUUID().replace(/-/g, '')}`;
  const supportId = randomUUID();
  const supportTg = `tg_erbac2_sup_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac2_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac2_sup', 'user', NOW(), NOW())
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
    body: JSON.stringify({ title: 'Expert Ping Test', ownerUserId: adminId }),
  });
  if (createRes.status !== 201) {
    await pool.end();
    throw new Error(`Expected 201, got ${createRes.status}`);
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

  // Activate subscription so ping is allowed (Story 5.3 gating)
  const ownerId = randomUUID();
  const ownerTg = `tg_erbac2_owner_${randomUUID().replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac2_owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTg],
  );
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

test('support member → GET /experts/:expertId/admin-ping = 403 FORBIDDEN_EXPERT_ROLE + audit rbac.denied.expert_role', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;

  const adminId = randomUUID();
  const adminTg = `tg_erbac3_admin_${randomUUID().replace(/-/g, '')}`;
  const supportId = randomUUID();
  const supportTg = `tg_erbac3_sup_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac3_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac3_sup', 'user', NOW(), NOW())
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
    body: JSON.stringify({ title: 'Expert Admin Ping Deny', ownerUserId: adminId }),
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

  // Activate subscription so 403 is from role deny, not subscription (Story 5.3 gating)
  const ownerId = randomUUID();
  const ownerTg = `tg_erbac3_owner_${randomUUID().replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac3_owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTg],
  );
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

  const supportToken = signToken(supportId, supportTg);
  const res = await fetch(`${API_URL}/experts/${expertId}/admin-ping`, {
    headers: {
      Authorization: `Bearer ${supportToken}`,
      'x-request-id': traceId,
    },
  });

  if (res.status !== 403) {
    await pool.end();
    throw new Error(`Expected 403, got ${res.status}`);
  }
  const body = await res.json();
  if (body.code !== 'FORBIDDEN_EXPERT_ROLE') {
    await pool.end();
    throw new Error(`Expected code FORBIDDEN_EXPERT_ROLE, got ${body.code}`);
  }

  const audit = await pool.query(
    `SELECT action, trace_id FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  await pool.end();
  const denyRow = audit.rows.find((r) => r.action === 'rbac.denied.expert_role');
  if (!denyRow) {
    throw new Error(
      `Expected rbac.denied.expert_role for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
});

test('manager member → GET /experts/:expertId/admin-ping = 200', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTg = `tg_erbac4_admin_${randomUUID().replace(/-/g, '')}`;
  const managerId = randomUUID();
  const managerTg = `tg_erbac4_mgr_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac4_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac4_mgr', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [managerId, managerTg],
  );

  const adminToken = signToken(adminId, adminTg);
  const createRes = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Expert Admin Ping OK', ownerUserId: adminId }),
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
    body: JSON.stringify({ userId: managerId, role: 'manager' }),
  });

  // Activate subscription (Story 5.3 gating)
  const ownerId = randomUUID();
  const ownerTg = `tg_erbac4_owner_${randomUUID().replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac4_owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTg],
  );
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

  const managerToken = signToken(managerId, managerTg);
  const res = await fetch(`${API_URL}/experts/${expertId}/admin-ping`, {
    headers: { Authorization: `Bearer ${managerToken}` },
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

test('audit deny meta contains expertId, requiredRole, userRole, path, method', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-meta-${randomUUID()}`;

  const adminId = randomUUID();
  const adminTg = `tg_erbac5_admin_${randomUUID().replace(/-/g, '')}`;
  const noMemberId = randomUUID();
  const noMemberTg = `tg_erbac5_nomem_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac5_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac5_nomem', 'user', NOW(), NOW())
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
    body: JSON.stringify({ title: 'Expert Meta Test', ownerUserId: adminId }),
  });
  if (createRes.status !== 201) {
    await pool.end();
    throw new Error(`Expected 201, got ${createRes.status}`);
  }
  const { id: expertId } = await createRes.json();

  const noMemberToken = signToken(noMemberId, noMemberTg);
  await fetch(`${API_URL}/experts/${expertId}/ping`, {
    headers: {
      Authorization: `Bearer ${noMemberToken}`,
      'x-request-id': traceId,
    },
  });

  const audit = await pool.query(
    `SELECT meta FROM audit_log WHERE trace_id = $1 AND action = 'rbac.denied.expert_membership'`,
    [traceId],
  );
  await pool.end();
  if (audit.rows.length === 0) {
    throw new Error(`Expected audit entry with action rbac.denied.expert_membership and trace_id=${traceId}`);
  }
  const meta = audit.rows[0].meta;
  if (!meta || typeof meta !== 'object') {
    throw new Error(`Expected meta object, got ${typeof meta}`);
  }
  const required = ['expertId', 'requiredRole', 'userRole', 'path', 'method'];
  for (const key of required) {
    if (!(key in meta)) {
      throw new Error(`Expected meta.${key}, got keys: ${Object.keys(meta).join(', ')}`);
    }
  }
  if (meta.expertId !== expertId) {
    throw new Error(`Expected meta.expertId ${expertId}, got ${meta.expertId}`);
  }
});

test('trace_id in audit matches x-request-id', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-xrid-${randomUUID()}`;

  const adminId = randomUUID();
  const adminTg = `tg_erbac6_admin_${randomUUID().replace(/-/g, '')}`;
  const supportId = randomUUID();
  const supportTg = `tg_erbac6_sup_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac6_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac6_sup', 'user', NOW(), NOW())
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
    body: JSON.stringify({ title: 'Expert Trace Test', ownerUserId: adminId }),
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

  // Activate subscription so 403 is from role deny (Story 5.3 gating)
  const ownerId = randomUUID();
  const ownerTg = `tg_erbac6_owner_${randomUUID().replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac6_owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTg],
  );
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

  const supportToken = signToken(supportId, supportTg);
  await fetch(`${API_URL}/experts/${expertId}/admin-ping`, {
    headers: {
      Authorization: `Bearer ${supportToken}`,
      'x-request-id': traceId,
    },
  });

  const audit = await pool.query(
    `SELECT trace_id FROM audit_log WHERE trace_id = $1 AND action = 'rbac.denied.expert_role'`,
    [traceId],
  );
  await pool.end();
  if (audit.rows.length === 0) {
    throw new Error(`Expected audit row with trace_id=${traceId} and action rbac.denied.expert_role`);
  }
  if (audit.rows[0].trace_id !== traceId) {
    throw new Error(`Audit trace_id ${audit.rows[0].trace_id} !== x-request-id ${traceId}`);
  }
});

test('manager member → GET /experts/:expertId/ping = 200', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTg = `tg_erbac7_admin_${randomUUID().replace(/-/g, '')}`;
  const managerId = randomUUID();
  const managerTg = `tg_erbac7_mgr_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac7_admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTg],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac7_mgr', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [managerId, managerTg],
  );

  const adminToken = signToken(adminId, adminTg);
  const createRes = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Expert Manager Ping', ownerUserId: adminId }),
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
    body: JSON.stringify({ userId: managerId, role: 'manager' }),
  });

  // Activate subscription (Story 5.3 gating)
  const ownerId = randomUUID();
  const ownerTg = `tg_erbac7_owner_${randomUUID().replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'erbac7_owner', 'owner', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'owner'`,
    [ownerId, ownerTg],
  );
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

  const managerToken = signToken(managerId, managerTg);
  const res = await fetch(`${API_URL}/experts/${expertId}/ping`, {
    headers: { Authorization: `Bearer ${managerToken}` },
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
