#!/usr/bin/env node

/**
 * Preflight check for Docker Postgres container
 *
 * Ensures Docker Postgres container is running and healthy.
 * Since Docker Postgres uses port 5433 (not 5432), there's no conflict with local Postgres.
 */

import { execSync } from 'node:child_process';

const CONTAINER_NAME = 'tracked_postgres';

function checkContainer() {
  try {
    const output = execSync(
      `docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" --format "{{.Names}}\t{{.Status}}" 2>/dev/null || true`,
      { encoding: 'utf-8' },
    );
    return output.trim();
  } catch {
    return '';
  }
}

function main() {
  const containerInfo = checkContainer();

  if (!containerInfo || !containerInfo.includes(CONTAINER_NAME)) {
    console.error(`❌ Docker Postgres container "${CONTAINER_NAME}" is not running`);
    console.error('');
    console.error('Fix: Start Docker Compose Postgres:');
    console.error('   pnpm infra:up');
    console.error('   # or');
    console.error('   docker compose -f infra/docker-compose.yml --env-file .env up -d postgres');
    console.error('');
    return 1;
  }

  // Check if container is healthy
  if (containerInfo.includes('healthy') || containerInfo.includes('Up')) {
    console.log(`✅ Docker Postgres container "${CONTAINER_NAME}" is running`);
    console.log(`   ${containerInfo}`);
    return 0;
  }

  console.warn(`⚠️  Docker Postgres container "${CONTAINER_NAME}" is running but may not be healthy`);
  console.warn(`   ${containerInfo}`);
  console.warn('');
  console.warn('Wait a few seconds for health check, or check logs:');
  console.warn('   docker compose -f infra/docker-compose.yml logs postgres');
  console.warn('');
  return 0; // Warning, not error
}

process.exit(main());
