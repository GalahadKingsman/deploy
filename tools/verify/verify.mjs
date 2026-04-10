#!/usr/bin/env node

/**
 * Quality Gates Verification Script
 * Runs all automated checks for the repository.
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

function runCommand(command, description, silent = false) {
  try {
    info(`Running: ${description}`);
    if (silent) {
      execSync(command, { stdio: 'pipe', cwd: process.cwd() });
    } else {
      execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    }
    success(`${description} passed`);
    return true;
  } catch (err) {
    error(`${description} failed`);
    return false;
  }
}

function checkCommandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function verifyWorkspace() {
  log('\n📦 Checking workspace...', colors.blue);
  try {
    info('Running: Workspace list');
    const output = execSync('pnpm -r list --depth 0', { encoding: 'utf-8', stdio: 'pipe' });
    const packages = output.match(/@tracked\/\w+/g) || [];
    const uniquePackages = [...new Set(packages)];
    
    if (uniquePackages.length < 4) {
      error(`Expected 4 packages, found ${uniquePackages.length}: ${uniquePackages.join(', ')}`);
      return false;
    }
    
    success(`Workspace list passed (found ${uniquePackages.length} packages)`);
    return true;
  } catch (err) {
    error('Workspace list failed');
    return false;
  }
}

function verifyDeepImports() {
  log('\n🔍 Checking for deep imports...', colors.blue);

  const pattern = '@tracked/shared/src';
  let command;
  let tool;

  if (checkCommandExists('rg')) {
    tool = 'ripgrep (rg)';
    // Only check TS/JS files, exclude docs, comments, and build artifacts
    command = `rg "${pattern}" -n --glob '**/*.ts' --glob '**/*.tsx' --glob '**/*.js' --glob '**/*.jsx' --glob '!**/*.md' --glob '!**/*.mdc' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.turbo/**'`;
  } else if (checkCommandExists('grep')) {
    tool = 'grep';
    command = `grep -R "${pattern}" . --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=.git -n`;
  } else {
    error('Neither ripgrep (rg) nor grep found. Please install ripgrep: brew install ripgrep');
    process.exit(1);
  }

  try {
    info(`Using ${tool} to check for deep imports in TS/JS files`);
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    const matches = output.trim();

    if (matches) {
      // Filter out comments and string literals (basic check)
      const lines = matches.split('\n').filter((line) => {
        // Skip lines that are clearly comments or documentation
        const trimmed = line.trim();
        return (
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('*') &&
          !trimmed.startsWith('/*') &&
          trimmed.includes("from '@tracked/shared/src") ||
          trimmed.includes('from "@tracked/shared/src')
        );
      });

      if (lines.length > 0) {
        error('Deep imports found in code:');
        console.log(lines.join('\n'));
        error('\nDeep imports are forbidden. Use @tracked/shared instead of @tracked/shared/src/*');
        return false;
      }
    }

    success('No deep imports found');
    return true;
  } catch (err) {
    // grep/rg exit code 1 means "no matches" - that's success
    if (err.status === 1) {
      success('No deep imports found');
      return true;
    }
    // Other errors are real problems
    error(`Failed to check deep imports: ${err.message}`);
    return false;
  }
}

function verifyNoWildcardPaths() {
  log('\n🚫 Checking for wildcard paths in tsconfig...', colors.blue);

  const pattern = '@tracked/shared/\\*';
  let command;
  let tool;

  if (checkCommandExists('rg')) {
    tool = 'ripgrep (rg)';
    command = `rg "${pattern}" -n --glob '**/tsconfig*.json' --glob '!**/node_modules/**' --glob '!**/dist/**'`;
  } else if (checkCommandExists('grep')) {
    tool = 'grep';
    command = `grep -R "${pattern}" . --include='tsconfig*.json' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=.git -n`;
  } else {
    error('Neither ripgrep (rg) nor grep found. Please install ripgrep: brew install ripgrep');
    process.exit(1);
  }

  try {
    info(`Using ${tool} to check for wildcard paths in tsconfig files`);
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    const matches = output.trim();

    if (matches) {
      error('Wildcard paths found in tsconfig:');
      console.log(matches);
      error('\nWildcard paths (@tracked/shared/*) are forbidden. Only root mapping (@tracked/shared) is allowed.');
      return false;
    }

    success('No wildcard paths found');
    return true;
  } catch (err) {
    // grep/rg exit code 1 means "no matches" - that's success
    if (err.status === 1) {
      success('No wildcard paths found');
      return true;
    }
    // Other errors are real problems
    error(`Failed to check wildcard paths: ${err.message}`);
    return false;
  }
}

function verifyLint() {
  log('\n🔧 Running lint...', colors.blue);
  return runCommand('pnpm -w lint', 'Lint');
}

function verifyTypecheck() {
  log('\n📝 Running typecheck...', colors.blue);
  return runCommand('pnpm -w typecheck', 'Typecheck');
}

function verifyBuild() {
  log('\n🏗️  Running build...', colors.blue);
  return runCommand('pnpm -w build', 'Build');
}

function verifySharedConfig() {
  log('\n🔧 Checking shared package configuration...', colors.blue);
  try {
    const configOutput = execSync('pnpm exec tsc -p packages/shared/tsconfig.json --showConfig', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      stdio: 'pipe',
    });
    const configObj = JSON.parse(configOutput);
    const compilerOptions = configObj.compilerOptions || {};

    const checks = [
      { name: 'strict', expected: true, actual: compilerOptions.strict },
      { name: 'target', expected: 'es2022', actual: compilerOptions.target?.toLowerCase() },
      { name: 'module', expected: 'commonjs', actual: compilerOptions.module?.toLowerCase() },
      {
        name: 'moduleResolution',
        expected: ['node', 'node10', 'nodenext'],
        actual: compilerOptions.moduleResolution?.toLowerCase(),
        check: (actual, expected) => expected.includes(actual),
      },
    ];

    let allPassed = true;
    for (const check of checks) {
      const passed = check.check
        ? check.check(check.actual, check.expected)
        : check.actual === check.expected;
      if (!passed) {
        log(
          `  ❌ ${check.name}: expected ${Array.isArray(check.expected) ? check.expected.join(' or ') : check.expected}, got ${check.actual}`,
          colors.red,
        );
        allPassed = false;
      } else {
        log(`  ✅ ${check.name}: ${check.actual}`, colors.green);
      }
    }

    // Check that shared doesn't use paths from base config
    if (compilerOptions.paths && Object.keys(compilerOptions.paths).length > 0) {
      log(
        `  ⚠️  Warning: shared tsconfig has paths defined (should not extend base config)`,
        colors.yellow,
      );
    }

    if (!allPassed) {
      throw new Error('Shared package configuration mismatch');
    }
    success('Shared config check passed');
    return true;
  } catch (err) {
    error(`Failed: ${err.message}`);
    if (err.stdout) {
      log(`  Output: ${err.stdout}`, colors.yellow);
    }
    return false;
  }
}

function verifyNoDuplicateErrorCodes() {
  log('\n🚫 Checking for duplicate error codes in apps...', colors.blue);

  const patterns = [
    'export enum ErrorCodes',
    'VALIDATION_ERROR',
    'INTERNAL_ERROR',
    'NOT_FOUND',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'CONFLICT',
    'RATE_LIMITED',
  ];

  let command;
  let tool;

  if (checkCommandExists('rg')) {
    tool = 'ripgrep (rg)';
    // Search for error code definitions in apps, excluding imports
    const pattern = patterns.join('|');
    command = `rg "${pattern}" -n apps --glob '**/*.ts' --glob '**/*.tsx' --glob '!**/node_modules/**' --glob '!**/dist/**'`;
  } else if (checkCommandExists('grep')) {
    tool = 'grep';
    const pattern = patterns.join('\\|');
    command = `grep -R "${pattern}" apps --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=dist -n`;
  } else {
    error('Neither ripgrep (rg) nor grep found. Please install ripgrep: brew install ripgrep');
    process.exit(1);
  }

  try {
    info(`Using ${tool} to check for duplicate error codes in apps`);
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    const matches = output.trim();

    if (matches) {
      // Filter out imports from @tracked/shared (these are allowed)
      const lines = matches.split('\n').filter((line) => {
        const trimmed = line.trim();
        // Skip lines that are imports
        if (
          trimmed.includes("from '@tracked/shared'") ||
          trimmed.includes('from "@tracked/shared"') ||
          trimmed.includes("import {") ||
          trimmed.startsWith('//') ||
          trimmed.startsWith('*')
        ) {
          return false;
        }
        // Check if it's a definition (export enum, const, etc.)
        return (
          trimmed.includes('export enum') ||
          trimmed.includes('export const') ||
          trimmed.includes('= VALIDATION_ERROR') ||
          trimmed.includes('= INTERNAL_ERROR')
        );
      });

      if (lines.length > 0) {
        error('Duplicate error codes found in apps (should only be in @tracked/shared):');
        console.log(lines.join('\n'));
        error('\nError codes must be defined only in @tracked/shared. Import from @tracked/shared instead.');
        return false;
      }
    }

    success('No duplicate error codes found');
    return true;
  } catch (err) {
    // grep/rg exit code 1 means "no matches" - that's success
    if (err.status === 1) {
      success('No duplicate error codes found');
      return true;
    }
    // Other errors are real problems
    error(`Failed to check duplicate error codes: ${err.message}`);
    return false;
  }
}

function verifyNoManualErrorFormat() {
  log('\n🚫 Checking for manual error format in API controllers...', colors.blue);

  const pattern = 'statusCode"\\s*:';
  let command;
  let tool;

  // Whitelist: only apps/api/src/common/errors/** is allowed to format errors
  // Exclude: swagger docs, mocks, tests, error filter itself
  const excludePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/errors/**', // Error filter is allowed
    '**/*.test.*',
    '**/*.spec.*',
    '**/__mocks__/**',
    '**/__tests__/**',
  ];

  if (checkCommandExists('rg')) {
    tool = 'ripgrep (rg)';
    const excludeGlobs = excludePatterns.map((p) => `--glob '!${p}'`).join(' ');
    command = `rg 'statusCode"\\s*:' -n apps/api/src ${excludeGlobs} -t ts`;
  } else if (checkCommandExists('grep')) {
    tool = 'grep';
    const excludeDirs = ['node_modules', 'dist', 'errors', '__mocks__', '__tests__'];
    const excludeFiles = ['*.test.*', '*.spec.*'];
    const excludeDirsStr = excludeDirs.map((d) => `--exclude-dir=${d}`).join(' ');
    const excludeFilesStr = excludeFiles.map((f) => `--exclude=${f}`).join(' ');
    command = `grep -R 'statusCode"\\s*:' apps/api/src --include='*.ts' ${excludeDirsStr} ${excludeFilesStr} -n`;
  } else {
    error('Neither ripgrep (rg) nor grep found. Please install ripgrep: brew install ripgrep');
    process.exit(1);
  }

  try {
    info(`Using ${tool} to check for manual error format in API controllers`);
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    const matches = output.trim();

    if (matches) {
      error('Manual error format found in controllers (should use centralized error filter):');
      console.log(matches);
      error('\nAll errors must go through ApiExceptionFilter. Do not format errors manually in controllers.');
      return false;
    }

    success('No manual error format found');
    return true;
  } catch (err) {
    // grep/rg exit code 1 means "no matches" - that's success
    if (err.status === 1) {
      success('No manual error format found');
      return true;
    }
    // Other errors are real problems
    error(`Failed to check manual error format: ${err.message}`);
    return false;
  }
}

// Main execution
function main() {
  log('\n🚀 Quality Gates Verification\n', colors.blue);

  const checks = [
    { name: 'Workspace', fn: verifyWorkspace },
    { name: 'Deep Imports', fn: verifyDeepImports },
    { name: 'Wildcard Paths', fn: verifyNoWildcardPaths },
    { name: 'Duplicate Error Codes', fn: verifyNoDuplicateErrorCodes },
    { name: 'Manual Error Format', fn: verifyNoManualErrorFormat },
    { name: 'Shared Config', fn: verifySharedConfig },
    { name: 'Lint', fn: verifyLint },
    { name: 'Typecheck', fn: verifyTypecheck },
    { name: 'Build', fn: verifyBuild },
  ];

  const results = [];

  for (const check of checks) {
    const passed = check.fn();
    results.push({ name: check.name, passed });

    if (!passed) {
      log(`\n❌ Quality gate "${check.name}" failed. Fix errors before proceeding.`, colors.red);
      process.exit(1);
    }
  }

  log('\n✨ All quality gates passed!\n', colors.green);
  process.exit(0);
}

main();
