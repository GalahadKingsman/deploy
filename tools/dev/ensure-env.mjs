#!/usr/bin/env node
/**
 * Ensure .env exists and has minimal required values for local dev.
 * - If .env missing: copy from .env.example
 * - If JWT_ACCESS_SECRET empty or < 16 chars: set to 32-char random (dev-only)
 * Run before dev/start so one command always works.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');
const appEnvTargets = [
  resolve(root, 'apps', 'api', '.env'),
  resolve(root, 'apps', 'webapp', '.env'),
  resolve(root, 'apps', 'bot', '.env'),
];

if (!existsSync(examplePath)) {
  console.warn('⚠️  .env.example not found, skipping ensure-env');
  process.exit(0);
}

if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  console.log('✅ Created .env from .env.example');
}

let content = readFileSync(envPath, 'utf8');

// Ensure JWT_ACCESS_SECRET is at least 16 chars (API schema requirement)
const secretMatch = content.match(/^JWT_ACCESS_SECRET=(.*)$/m);
const currentSecret = secretMatch ? secretMatch[1].trim() : '';
if (!currentSecret || currentSecret.length < 16) {
  const newSecret = randomBytes(16).toString('hex');
  if (secretMatch) {
    content = content.replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${newSecret}`);
  } else {
    content = content.trimEnd() + `\nJWT_ACCESS_SECRET=${newSecret}\n`;
  }
  writeFileSync(envPath, content);
  console.log('✅ Set JWT_ACCESS_SECRET for local dev');
}

// Make sure app-local ".env" exists for processes started from subfolders.
// (API runs `node --env-file-if-exists=.env` from `apps/api`).
for (const targetPath of appEnvTargets) {
  if (!existsSync(targetPath)) {
    copyFileSync(envPath, targetPath);
    console.log(`✅ Created ${targetPath} from root .env`);
  }
}
