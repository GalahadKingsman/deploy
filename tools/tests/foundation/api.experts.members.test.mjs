#!/usr/bin/env node

/**
 * Foundation Experts Test: Admin expert + member endpoints
 * Story 4.2: experts, expert_members, admin endpoints, audit trail
 *
 * Skips if DATABASE_URL unset.
 * Requires: applied_migrations 003 and 004, experts and expert_members tables.
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
    console.log('⏭️  Skipping experts tests: DATABASE_URL unset');
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

// applied_migrations 003+004 check lives in api.rbac.platform-roles.test.mjs only (no duplication)

test('user → POST /admin/experts returns 403 FORBIDDEN_PLATFORM_ROLE + audit deny by trace_id', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;

  const userId = randomUUID();
  const telegramUserId = `tg_${randomUUID().replace(/-/g, '')}`;
  const ownerUserId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'testuser', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [userId, telegramUserId],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'owner', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [ownerUserId, ownerTgId],
  );

  const token = signToken(userId, telegramUserId);
  const res = await fetch(`${API_URL}/admin/experts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-request-id': traceId,
    },
    body: JSON.stringify({ title: 'Test Expert', ownerUserId }),
  });

  if (res.status !== 403) {
    throw new Error(`Expected 403, got ${res.status}`);
  }

  const body = await res.json();
  if (body.code !== 'FORBIDDEN_PLATFORM_ROLE') {
    throw new Error(`Expected code FORBIDDEN_PLATFORM_ROLE, got ${body.code}`);
  }

  const audit = await pool.query(
    `SELECT action FROM audit_log WHERE trace_id = $1`,
    [traceId],
  );
  await pool.end();

  const denyEntry = audit.rows.find((r) => r.action === 'rbac.denied.platform_role');
  if (!denyEntry) {
    throw new Error(
      `Expected rbac.denied.platform_role for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
});

test('admin → POST /admin/experts returns 201 + expert and owner member created in DB', async (t) => {
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
    body: JSON.stringify({ title: 'New Expert Org', ownerUserId }),
  });

  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`Expected 201, got ${res.status}: ${text}`);
  }

  const body = await res.json();
  if (!body.id || typeof body.id !== 'string') {
    throw new Error(`Expected { id: string }, got ${JSON.stringify(body)}`);
  }

  const expertId = body.id;

  const expertRows = await pool.query('SELECT * FROM experts WHERE id = $1', [expertId]);
  if (expertRows.rows.length === 0) {
    throw new Error('Expert was not created in DB');
  }

  const memberRows = await pool.query(
    'SELECT * FROM expert_members WHERE expert_id = $1 AND user_id = $2',
    [expertId, ownerUserId],
  );
  if (memberRows.rows.length === 0) {
    throw new Error('Owner member was not created in DB');
  }
  if (memberRows.rows[0].role !== 'owner') {
    throw new Error(`Expected role owner, got ${memberRows.rows[0].role}`);
  }

  await pool.end();
});

test('admin → POST /admin/experts/:id/members add member → 200 + audit admin.expert.member.add', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const ownerUserId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const memberUserId = randomUUID();
  const memberTgId = `tg_member_${randomUUID().replace(/-/g, '')}`;

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
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'member', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [memberUserId, memberTgId],
  );

  const expertId = randomUUID();
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerUserId],
  );
  await pool.query(
    `INSERT INTO expert_members (expert_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [expertId, ownerUserId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-request-id': traceId,
    },
    body: JSON.stringify({ userId: memberUserId, role: 'manager' }),
  });

  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`Expected 201, got ${res.status}: ${text}`);
  }

  const audit = await pool.query(
    `SELECT action, meta FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  await pool.end();

  const addEntry = audit.rows.find((r) => r.action === 'admin.expert.member.add');
  if (!addEntry) {
    throw new Error(
      `Expected admin.expert.member.add for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
  if (addEntry.meta?.role !== 'manager') {
    throw new Error(`Expected meta.role=manager, got ${JSON.stringify(addEntry.meta)}`);
  }
});

test('admin → repeat add same member → 409 EXPERT_MEMBER_ALREADY_EXISTS', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const userId = randomUUID();
  const userTgId = `tg_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTgId],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'user', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [userId, userTgId],
  );

  const expertId = randomUUID();
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, userId],
  );
  await pool.query(
    `INSERT INTO expert_members (expert_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [expertId, userId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, role: 'manager' }),
  });

  await pool.end();

  if (res.status !== 409) {
    throw new Error(`Expected 409, got ${res.status}`);
  }

  const body = await res.json();
  if (body.code !== 'EXPERT_MEMBER_ALREADY_EXISTS') {
    throw new Error(`Expected code EXPERT_MEMBER_ALREADY_EXISTS, got ${body.code}`);
  }
});

test('admin → PATCH member role → 200 + audit admin.expert.member.role.set', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const userId = randomUUID();
  const userTgId = `tg_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTgId],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'user', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [userId, userTgId],
  );

  const expertId = randomUUID();
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, userId],
  );
  await pool.query(
    `INSERT INTO expert_members (expert_id, user_id, role) VALUES ($1, $2, 'manager')`,
    [expertId, userId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/members/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-request-id': traceId,
    },
    body: JSON.stringify({ role: 'reviewer' }),
  });

  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`Expected 200, got ${res.status}: ${text}`);
  }

  const audit = await pool.query(
    `SELECT action, meta FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  const memberRow = await pool.query(
    'SELECT role FROM expert_members WHERE expert_id = $1 AND user_id = $2',
    [expertId, userId],
  );
  await pool.end();

  const roleSetEntry = audit.rows.find((r) => r.action === 'admin.expert.member.role.set');
  if (!roleSetEntry) {
    throw new Error(
      `Expected admin.expert.member.role.set for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
  if (roleSetEntry.meta?.from !== 'manager' || roleSetEntry.meta?.to !== 'reviewer') {
    throw new Error(`Expected meta { from: 'manager', to: 'reviewer' }, got ${JSON.stringify(roleSetEntry.meta)}`);
  }
  if (memberRow.rows[0].role !== 'reviewer') {
    throw new Error(`Expected role reviewer in DB, got ${memberRow.rows[0].role}`);
  }
});

test('admin → DELETE member → 200 + audit admin.expert.member.remove', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const traceId = `trace-${randomUUID()}`;

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const ownerUserId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const memberUserId = randomUUID();
  const memberTgId = `tg_member_${randomUUID().replace(/-/g, '')}`;

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
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'member', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [memberUserId, memberTgId],
  );

  const expertId = randomUUID();
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerUserId],
  );
  await pool.query(
    `INSERT INTO expert_members (expert_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [expertId, ownerUserId],
  );
  await pool.query(
    `INSERT INTO expert_members (expert_id, user_id, role) VALUES ($1, $2, 'support')`,
    [expertId, memberUserId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/members/${memberUserId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-request-id': traceId,
    },
  });

  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`Expected 200, got ${res.status}: ${text}`);
  }

  const audit = await pool.query(
    `SELECT action FROM audit_log WHERE trace_id = $1 ORDER BY created_at DESC`,
    [traceId],
  );
  const memberRow = await pool.query(
    'SELECT 1 FROM expert_members WHERE expert_id = $1 AND user_id = $2',
    [expertId, memberUserId],
  );
  await pool.end();

  const removeEntry = audit.rows.find((r) => r.action === 'admin.expert.member.remove');
  if (!removeEntry) {
    throw new Error(
      `Expected admin.expert.member.remove for trace_id=${traceId}, got: ${audit.rows.map((r) => r.action).join(', ')}`,
    );
  }
  if (memberRow.rows.length > 0) {
    throw new Error('Member should have been removed from DB');
  }
});

test('admin → add member to non-existent expert → 404 EXPERT_NOT_FOUND', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const userId = randomUUID();
  const userTgId = `tg_${randomUUID().replace(/-/g, '')}`;
  const fakeExpertId = randomUUID();

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'admin', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'admin'`,
    [adminId, adminTgId],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'user', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [userId, userTgId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts/${fakeExpertId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, role: 'manager' }),
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

test('admin → PATCH member when not exists → 404 EXPERT_MEMBER_NOT_FOUND', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const ownerUserId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const unknownUserId = randomUUID();

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

  const expertId = randomUUID();
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerUserId],
  );
  await pool.query(
    `INSERT INTO expert_members (expert_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [expertId, ownerUserId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/members/${unknownUserId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'manager' }),
  });

  await pool.end();

  if (res.status !== 404) {
    throw new Error(`Expected 404, got ${res.status}`);
  }

  const body = await res.json();
  if (body.code !== 'EXPERT_MEMBER_NOT_FOUND') {
    throw new Error(`Expected code EXPERT_MEMBER_NOT_FOUND, got ${body.code}`);
  }
});

test('admin → DELETE member when not exists → 404 EXPERT_MEMBER_NOT_FOUND', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const ownerUserId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const unknownUserId = randomUUID();

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

  const expertId = randomUUID();
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerUserId],
  );
  await pool.query(
    `INSERT INTO expert_members (expert_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [expertId, ownerUserId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/members/${unknownUserId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  await pool.end();

  if (res.status !== 404) {
    throw new Error(`Expected 404, got ${res.status}`);
  }

  const body = await res.json();
  if (body.code !== 'EXPERT_MEMBER_NOT_FOUND') {
    throw new Error(`Expected code EXPERT_MEMBER_NOT_FOUND, got ${body.code}`);
  }
});

test('admin → add member with invalid role → 400 INVALID_EXPERT_MEMBER_ROLE', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });

  const adminId = randomUUID();
  const adminTgId = `tg_admin_${randomUUID().replace(/-/g, '')}`;
  const ownerUserId = randomUUID();
  const ownerTgId = `tg_owner_${randomUUID().replace(/-/g, '')}`;
  const memberUserId = randomUUID();
  const memberTgId = `tg_member_${randomUUID().replace(/-/g, '')}`;

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
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'member', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET platform_role = 'user'`,
    [memberUserId, memberTgId],
  );

  const expertId = randomUUID();
  await pool.query(
    `INSERT INTO experts (id, title, slug, created_by_user_id, created_at, updated_at)
     VALUES ($1, 'Expert', NULL, $2, NOW(), NOW())`,
    [expertId, ownerUserId],
  );
  await pool.query(
    `INSERT INTO expert_members (expert_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [expertId, ownerUserId],
  );

  const token = signToken(adminId, adminTgId);
  const res = await fetch(`${API_URL}/admin/experts/${expertId}/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: memberUserId, role: 'invalid_role' }),
  });

  await pool.end();

  if (res.status !== 400) {
    throw new Error(`Expected 400, got ${res.status}`);
  }

  const body = await res.json();
  if (body.code !== 'INVALID_EXPERT_MEMBER_ROLE') {
    throw new Error(`Expected code INVALID_EXPERT_MEMBER_ROLE, got ${body.code}`);
  }
});
