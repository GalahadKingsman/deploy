#!/usr/bin/env node
/**
 * Fail fast if API_PORT (default 3001) is already bound — avoids Nest boot + EADDRINUSE.
 */
import net from 'node:net';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const envPath = resolve(root, '.env');

function readApiPort() {
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    const m = content.match(/^API_PORT=(.+)$/m);
    if (m?.[1]) {
      const p = Number(String(m[1]).trim().replace(/^['"]|['"]$/g, ''));
      if (Number.isFinite(p) && p > 0 && p < 65536) return p;
    }
  }
  return 3001;
}

const port = readApiPort();
const server = net.createServer();

await new Promise((resolvePromise, rejectPromise) => {
  server.once('error', (err) => {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EADDRINUSE') {
      console.error(`\n❌ Порт ${port} уже занят — скорее всего запущен другой экземпляр API.`);
      console.error('\nОсвободить порт в PowerShell:');
      console.error(`   Get-NetTCPConnection -LocalPort ${port} | Select-Object -ExpandProperty OwningProcess`);
      console.error('   Stop-Process -Id <PID> -Force');
      console.error('\nИли (cmd):');
      console.error(`   netstat -ano | findstr :${port}`);
      console.error('   taskkill /PID <pid> /F');
      console.error('');
      process.exit(1);
    }
    rejectPromise(err);
  });
  server.listen(port, '0.0.0.0', () => {
    server.close(() => resolvePromise());
  });
});

console.log(`✅ Порт ${port} свободен для API`);
