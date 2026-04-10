#!/usr/bin/env node

/**
 * Foundation GET/POST /me/expert-application Test (Story 5.6)
 * No application → GET 200 { application: null }.
 * Submit → POST → pending; GET → pending.
 * Resubmit from rejected: set status=rejected in DB, POST → pending, decided_* cleared.
 * Audit: expert.application.submitted with trace_id = x-request-id.
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
    console.log('Skipping me/expert-application tests: DATABASE_URL unset');
    return;
  }
  await buildApi();
  await startApi({
    skipDb: false,
    extraEnv: {
      DATABASE_URL: dbUrl,
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || JWT_SECRET,
    },
  });
});

test.after(async () => {
  await stopApi();
});

test('no application → GET /me/expert-application = 200 { application: null }', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const userId = randomUUID();
  const tgId = `tg_app_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'me_app_student', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO NOTHING`,
    [userId, tgId],
  );
  await pool.end();

  const token = signToken(userId, tgId);
  const res = await fetch(`${API_URL}/me/expert-application`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`Expected 200, got ${res.status}: ${text}`);
  }

  const body = await res.json();
  if (body.application !== null) {
    throw new Error(`Expected application: null, got ${JSON.stringify(body.application)}`);
  }
});

test('submit → POST → pending; then GET → pending', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const userId = randomUUID();
  const tgId = `tg_app_sub_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'me_app_sub', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO NOTHING`,
    [userId, tgId],
  );
  await pool.end();

  const token = signToken(userId, tgId);
  const postRes = await fetch(`${API_URL}/me/expert-application`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note: 'I want to become an expert' }),
  });

  if (postRes.status !== 200) {
    const text = await postRes.text();
    throw new Error(`Expected 200 from POST, got ${postRes.status}: ${text}`);
  }

  const postBody = await postRes.json();
  if (!postBody.application || postBody.application.status !== 'pending') {
    throw new Error(`Expected application.status=pending, got ${postBody.application?.status}`);
  }

  const getRes = await fetch(`${API_URL}/me/expert-application`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (getRes.status !== 200) {
    const text = await getRes.text();
    throw new Error(`Expected 200 from GET, got ${getRes.status}: ${text}`);
  }
  const getBody = await getRes.json();
  if (!getBody.application || getBody.application.status !== 'pending') {
    throw new Error(`Expected GET application.status=pending, got ${getBody.application?.status}`);
  }
});

test('resubmit from rejected: DB status=rejected, POST → pending, decided_* cleared', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const userId = randomUUID();
  const tgId = `tg_app_rej_${randomUUID().replace(/-/g, '')}`;
  const deciderId = randomUUID();
  const deciderTgId = `tg_app_rej_decider_${randomUUID().replace(/-/g, '')}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'me_app_rej', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO NOTHING`,
    [userId, tgId],
  );
  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'decider', 'admin', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO NOTHING`,
    [deciderId, deciderTgId],
  );

  await pool.query(
    `INSERT INTO expert_applications (id, user_id, status, note, admin_note, created_at, updated_at, decided_at, decided_by_user_id)
     VALUES (gen_random_uuid(), $1, 'rejected', 'old note', 'Not enough experience', NOW(), NOW(), NOW(), $2)
     ON CONFLICT (user_id) DO UPDATE SET status = 'rejected', admin_note = 'Not enough experience', decided_at = NOW(), decided_by_user_id = $2`,
    [userId, deciderId],
  );

  const token = signToken(userId, tgId);
  const postRes = await fetch(`${API_URL}/me/expert-application`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note: 'Resubmitted note' }),
  });
  await pool.end();

  if (postRes.status !== 200) {
    const text = await postRes.text();
    throw new Error(`Expected 200 from POST resubmit, got ${postRes.status}: ${text}`);
  }

  const postBody = await postRes.json();
  if (!postBody.application || postBody.application.status !== 'pending') {
    throw new Error(`Expected application.status=pending after resubmit, got ${postBody.application?.status}`);
  }
  if (postBody.application.decidedAt != null || postBody.application.decidedByUserId != null) {
    throw new Error(
      `Expected decided_* cleared, got decidedAt=${postBody.application.decidedAt} decidedByUserId=${postBody.application.decidedByUserId}`,
    );
  }
});

test('audit by trace_id: after POST find expert.application.submitted', async (t) => {
  if (!dbUrl) {
    t.skip('DATABASE_URL unset');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl });

  const userId = randomUUID();
  const tgId = `tg_app_aud_${randomUUID().replace(/-/g, '')}`;
  const traceId = `trace-${randomUUID()}`;

  await pool.query(
    `INSERT INTO users (id, telegram_user_id, username, platform_role, created_at, updated_at)
     VALUES ($1, $2, 'me_app_aud', 'user', NOW(), NOW())
     ON CONFLICT (telegram_user_id) DO NOTHING`,
    [userId, tgId],
  );
  await pool.end();

  const token = signToken(userId, tgId);
  const postRes = await fetch(`${API_URL}/me/expert-application`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-request-id': traceId,
    },
    body: JSON.stringify({ note: 'Audit test' }),
  });

  if (postRes.status !== 200) {
    const text = await postRes.text();
    throw new Error(`Expected 200 from POST, got ${postRes.status}: ${text}`);
  }

  const pool2 = new Pool({ connectionString: dbUrl });
  const auditRes = await pool2.query(
    `SELECT created_at, action, trace_id, meta FROM audit_log WHERE trace_id = $1`,
    [traceId],
  );
  await pool2.end();

  if (auditRes.rows.length === 0) {
    throw new Error(`No audit log entry found for trace_id=${traceId}`);
  }
  const row = auditRes.rows[0];
  if (row.action !== 'expert.application.submitted' && row.action !== 'expert.application.resubmitted') {
    throw new Error(`Expected action expert.application.submitted or resubmitted, got ${row.action}`);
  }
  if (row.trace_id !== traceId) {
    throw new Error(`Expected trace_id=${traceId}, got ${row.trace_id}`);
  }
});
