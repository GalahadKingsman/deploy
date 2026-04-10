#!/usr/bin/env node

/**
 * Watchdog script: kills processes that exceed timeout (default 60s)
 * Usage: node tools/dev/run-with-timeout.mjs --timeout-ms=60000 -- <cmd> <args...>
 */

import { spawn } from 'node:child_process';

const idx = process.argv.indexOf('--');
const args = idx === -1 ? [] : process.argv.slice(idx + 1);

const timeoutMsArg = process.argv.find((a) => a.startsWith('--timeout-ms='));
const timeoutMs = timeoutMsArg ? Number(timeoutMsArg.split('=')[1]) : 60000;

if (args.length === 0) {
  console.error('Usage: node tools/dev/run-with-timeout.mjs --timeout-ms=60000 -- <cmd> <args...>');
  process.exit(2);
}

const cmd = args[0];
const cmdArgs = args.slice(1);

// detached -> we can kill process group
const child = spawn(cmd, cmdArgs, {
  stdio: 'inherit',
  env: process.env,
  detached: true,
});

let killed = false;

const killGroup = (signal) => {
  try {
    process.kill(-child.pid, signal);
  } catch {
    // Ignore errors (process may have already exited)
  }
};

const t = setTimeout(() => {
  killed = true;
  console.error(`\n[watchdog] Timeout ${timeoutMs}ms exceeded. Terminating process group...`);
  killGroup('SIGTERM');
  setTimeout(() => killGroup('SIGKILL'), 5000).unref();
}, timeoutMs);

child.on('exit', (code, signal) => {
  clearTimeout(t);
  if (killed) process.exit(124);
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
