#!/usr/bin/env node

/**
 * Протокол анти-зацикливания для выполнения команд
 *
 * Требования:
 * 1. Не использовать tail/head/grep в командах
 * 2. Логировать stdout+stderr в файл и дублировать в консоль
 * 3. После выполнения показать: EXIT=$? и последние 80 строк лога
 * 4. Если команда идёт > 60 секунд — остановить процесс (watchdog)
 *
 * Usage: node tools/dev/run-with-protocol.mjs --timeout-ms=60000 -- <cmd> <args...>
 */

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);

const sepIndex = argv.indexOf('--');
let cmdArgs = sepIndex === -1 ? argv : argv.slice(sepIndex + 1);

while (cmdArgs.length > 0 && cmdArgs[0] === '--') {
  cmdArgs = cmdArgs.slice(1);
}

const timeoutMsArg = argv.find((a) => a.startsWith('--timeout-ms='));
const timeoutMs = timeoutMsArg ? Number(timeoutMsArg.split('=')[1]) : 60000;

cmdArgs = cmdArgs.filter((a) => !a.startsWith('--timeout-ms='));
while (cmdArgs.length > 0 && cmdArgs[0] === '--') {
  cmdArgs = cmdArgs.slice(1);
}

if (cmdArgs.length === 0) {
  console.error('Usage: node tools/dev/run-with-protocol.mjs [--timeout-ms=60000] -- <cmd> <args...>');
  process.exit(2);
}

const timestamp = Date.now();
const LOG_FILE = join(tmpdir(), `cursor-step.${timestamp}.log`);

const cmd = cmdArgs[0];
const args = cmdArgs.slice(1);
const fullCmd = [cmd, ...args].join(' ');

const logStream = createWriteStream(LOG_FILE);
const startTime = Date.now();

const win32 = process.platform === 'win32';
/** Windows: resolve `pnpm`/`node` on PATH via shell. Unix: avoid shell for correct argv. */
const child = win32
  ? spawn(fullCmd, {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env,
      windowsHide: true,
    })
  : spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env,
      windowsHide: true,
    });

const pump = (stream, isErr) => {
  stream.on('data', (chunk) => {
    const sink = isErr ? process.stderr : process.stdout;
    sink.write(chunk);
    logStream.write(chunk);
  });
};

if (child.stdout) pump(child.stdout, false);
if (child.stderr) pump(child.stderr, true);

let killed = false;

const killChild = () => {
  try {
    if (child.pid && !child.killed) {
      child.kill('SIGTERM');
    }
  } catch {
    // ignore
  }
};

const t = setTimeout(() => {
  killed = true;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.error(`\n[watchdog] Timeout ${timeoutMs}ms (${elapsed}s) exceeded. Terminating child...`);
  killChild();
  setTimeout(() => {
    try {
      if (child.pid && !child.killed) child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }, 5000).unref();
}, timeoutMs);

child.on('close', (code, signal) => {
  clearTimeout(t);
  logStream.end();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const exitCode = killed ? 124 : signal ? 1 : code ?? 1;

  console.log(`\n--- Execution Summary ---`);
  console.log(`Command: ${fullCmd}`);
  console.log(`PID: ${child.pid}`);
  console.log(`Duration: ${elapsed}s`);
  if (killed) {
    console.log(`Status: Killed by watchdog (timeout ${timeoutMs}ms)`);
  } else if (signal) {
    console.log(`Status: Terminated by signal ${signal}`);
  } else {
    console.log(`Status: Completed`);
  }
  console.log(`EXIT=${exitCode}`);

  try {
    if (existsSync(LOG_FILE)) {
      const logContent = readFileSync(LOG_FILE, 'utf-8');
      const lines = logContent.split('\n');
      const lastLines = lines.slice(-80).join('\n');
      console.log('\n--- Last 80 lines of log ---');
      console.log(lastLines);
    } else {
      console.log('\n--- Log file not found ---');
    }
  } catch (err) {
    console.error(`\n--- Error reading log: ${err.message} ---`);
  }

  process.exit(exitCode);
});
