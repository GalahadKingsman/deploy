#!/usr/bin/env node
/**
 * Wait until PostgreSQL accepts connections (uses DATABASE_URL from repo root .env).
 * Run after `pnpm infra:up` or in parallel while Docker starts.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const root = resolve(process.cwd());
const envPath = resolve(root, '.env');

function readDatabaseUrl() {
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    const m = content.match(/^DATABASE_URL=(.+)$/m);
    if (m?.[1]) {
      return m[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return 'postgresql://tracked:tracked_password@localhost:5433/tracked_lms';
}

const url = readDatabaseUrl();
const maxAttempts = 90;
const delayMs = 1000;

for (let i = 0; i < maxAttempts; i++) {
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 2000,
  });
  try {
    await pool.query('SELECT 1');
    await pool.end();
    console.log(i > 0 ? '✅ Database is reachable (after wait)' : '✅ Database is reachable');
    process.exit(0);
  } catch {
    await pool.end().catch(() => {});
    if (i === 0) {
      console.log('⏳ Waiting for database at PostgreSQL…');
      console.log('   If this takes too long, start Docker and run: pnpm infra:up');
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

console.error('❌ Database not reachable after', maxAttempts, 'seconds.');
console.error('   Expected DATABASE_URL:', url.replace(/:[^:@/]+@/, ':****@'));
console.error('   Fix: pnpm infra:up   (then retry pnpm dev:app)');
process.exit(1);
