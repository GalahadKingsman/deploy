#!/usr/bin/env node

/**
 * Architecture Freeze Audit
 * Run before EPIC 1 to ensure no premature abstractions or architectural drift.
 */

import { execSync } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function checkCommandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runCheck(name, command, expectedMatches = 0) {
  try {
    info(`Checking: ${name}`);
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    const matches = output.trim().split('\n').filter((line) => line.trim().length > 0);

    if (matches.length > expectedMatches) {
      error(`${name}: Found ${matches.length} matches (expected ${expectedMatches})`);
      console.log(matches.join('\n'));
      return false;
    }

    success(`${name}: OK (${matches.length} matches)`);
    return true;
  } catch (err) {
    // Exit code 1 from grep/rg means "no matches" - that's success for our checks
    if (err.status === 1) {
      success(`${name}: OK (0 matches)`);
      return true;
    }
    error(`${name}: Failed - ${err.message}`);
    return false;
  }
}

function main() {
  log('\n🏛️  Architecture Freeze Audit\n', colors.blue);

  const tool = checkCommandExists('rg') ? 'rg' : 'grep';
  if (!checkCommandExists('rg') && !checkCommandExists('grep')) {
    error('Neither ripgrep (rg) nor grep found. Please install ripgrep: brew install ripgrep');
    process.exit(1);
  }

  const checks = [];

  // A) Check for premature abstractions in webapp
  log('\n📦 A) Premature Abstractions Check', colors.blue);
  if (tool === 'rg') {
    checks.push(
      runCheck(
        'No domain/ layer in webapp',
        "rg 'domain/' -n apps/webapp/src --glob '!**/node_modules/**' --glob '!**/dist/**' -t ts",
        0,
      ),
    );
    checks.push(
      runCheck(
        'No repositories/ layer in webapp',
        "rg 'repositories/' -n apps/webapp/src --glob '!**/node_modules/**' --glob '!**/dist/**' -t ts",
        0,
      ),
    );
    checks.push(
      runCheck(
        'No services/ layer in webapp',
        "rg 'services/' -n apps/webapp/src --glob '!**/node_modules/**' --glob '!**/dist/**' -t ts",
        0,
      ),
    );
    checks.push(
      runCheck(
        'No universal abstractions (EventBus, Mediator, Repository base, BaseService)',
        "rg 'EventBus|Mediator|Repository.*base|BaseService' -n apps --glob '!**/node_modules/**' --glob '!**/dist/**' -t ts",
        0,
      ),
    );
  } else {
    checks.push(
      runCheck(
        'No domain/ layer in webapp',
        "grep -R 'domain/' apps/webapp/src --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=dist -n",
        0,
      ),
    );
    checks.push(
      runCheck(
        'No repositories/ layer in webapp',
        "grep -R 'repositories/' apps/webapp/src --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=dist -n",
        0,
      ),
    );
    checks.push(
      runCheck(
        'No services/ layer in webapp',
        "grep -R 'services/' apps/webapp/src --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=dist -n",
        0,
      ),
    );
  }

  // B) Check for duplicates
  log('\n🔍 B) Duplication Check', colors.blue);
  if (tool === 'rg') {
    // Check for duplicate error codes, but exclude swagger examples
    // Only check actual definitions: export enum, const declarations, or assignments
    // Exclude lines containing 'schema:', 'example:', or '@ApiResponse' (swagger decorators)
    let output = '';
    try {
      output = execSync(
        "rg 'export enum ErrorCodes|export const ErrorCodes|ErrorCodes\\s*=|VALIDATION_ERROR\\s*=|INTERNAL_ERROR\\s*=' -n apps --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/*.test.*' --glob '!**/*.spec.*' -t ts",
        { encoding: 'utf-8', stdio: 'pipe' },
      );
    } catch (err) {
      // Exit code 1 from rg means "no matches" - that's success for our checks
      if (err.status === 1) {
        output = '';
      } else {
        throw err;
      }
    }

    // Split output into lines and check context
    const allLines = output.trim().split('\n');
    const lines = [];

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const lowerLine = line.toLowerCase();

      // Check if this line or nearby lines contain swagger context
      const contextLines = [
        allLines[Math.max(0, i - 3)],
        allLines[Math.max(0, i - 2)],
        allLines[Math.max(0, i - 1)],
        line,
        allLines[Math.min(allLines.length - 1, i + 1)],
        allLines[Math.min(allLines.length - 1, i + 2)],
        allLines[Math.min(allLines.length - 1, i + 3)],
      ]
        .filter((l) => l)
        .join(' ');

      const isSwaggerExample =
        contextLines.toLowerCase().includes('schema:') ||
        contextLines.toLowerCase().includes('example:') ||
        contextLines.toLowerCase().includes('@apiresponse') ||
        line.match(/code:\s*['"]/) || // Any code: "..." or code: '...' (string literals)
        line.match(/['"]code['"]/); // "code" as string key

      if (isSwaggerExample) {
        continue; // Skip swagger examples
      }

      // Only keep actual definitions (export, const, assignments from ErrorCodes enum)
      if (
        line.includes('export enum ErrorCodes') ||
        line.includes('export const ErrorCodes') ||
        (line.includes('ErrorCodes.') && !line.match(/['"]/)) // Usage of ErrorCodes from shared (not string literal)
      ) {
        lines.push(line);
      }
    }

    if (lines.length > 0) {
      error('No duplicate error codes in apps (excluding swagger examples): Found definitions');
      console.log(lines.join('\n'));
      checks.push(false);
    } else {
      success('No duplicate error codes in apps (excluding swagger examples): OK');
      checks.push(true);
    }
  } else {
    // Fallback to simpler check for grep
    checks.push(
      runCheck(
        'No duplicate error codes in apps (excluding swagger examples)',
        "grep -R 'export enum ErrorCodes\\|export const ErrorCodes' apps --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=dist --exclude='*.test.*' --exclude='*.spec.*' -n",
        0,
      ),
    );
  }

  checks.push(
    runCheck(
      'No deep imports from @tracked/shared/src',
      tool === 'rg'
        ? "rg '@tracked/shared/src' -n --glob '!**/node_modules/**' --glob '!**/dist/**' -t ts -t js"
        : "grep -R '@tracked/shared/src' . --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -n",
      0,
    ),
  );

  if (tool === 'rg') {
    checks.push(
      runCheck(
        'No wildcard paths in tsconfig',
        "rg '@tracked/shared/\\\\*' -n --glob '**/tsconfig*.json' --glob '!**/node_modules/**' --glob '!**/dist/**'",
        0,
      ),
    );
  }

  // C) Check API layer
  log('\n🔧 C) API Layer Check', colors.blue);
  if (tool === 'rg') {
    checks.push(
      runCheck(
        'No manual error format in controllers (excluding error filter)',
        "rg 'statusCode\"\\\\s*:' -n apps/api/src --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/errors/**' --glob '!**/*.test.*' --glob '!**/*.spec.*' -t ts",
        0,
      ),
    );
  } else {
    checks.push(
      runCheck(
        'No manual error format in controllers (excluding error filter)',
        "grep -R 'statusCode\"' apps/api/src --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=errors --exclude='*.test.*' --exclude='*.spec.*' -n",
        0,
      ),
    );
  }

  const allPassed = checks.every((result) => result === true);

  if (allPassed) {
    log('\n✨ Architecture Freeze Audit: PASSED\n', colors.green);
    process.exit(0);
  } else {
    log('\n❌ Architecture Freeze Audit: FAILED\n', colors.red);
    log('Fix the issues above before starting EPIC 1.', colors.red);
    process.exit(1);
  }
}

main();
