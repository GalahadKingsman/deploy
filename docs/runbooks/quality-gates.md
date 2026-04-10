# Quality Gates

## What are Quality Gates?

Quality Gates are automated and manual checks that ensure the repository maintains key invariants:

- **Workspace integrity** - All packages are recognized
- **Architecture rules** - No deep imports, proper module boundaries
- **Code quality** - Lint, typecheck, build pass
- **Infrastructure** - Services can start and run

## When to Run

### Before Opening PR

**Mandatory**: Run `pnpm verify` before creating any PR.

```bash
pnpm verify
```

If any gate fails, fix the issue before opening PR.

### Before Merge

All automated gates must pass in CI. Manual gates should be verified periodically.

### After Conflicts

After resolving merge conflicts, run `pnpm verify` to ensure nothing broke.

### Daily/Weekly

Run manual gates (infra, API health, bot start) to catch environment issues early.

## Command: `pnpm verify`

Runs all automated quality gates:

1. **Workspace** - Verifies all packages are recognized
2. **Deep Imports** - Checks for forbidden `@tracked/shared/src/*` imports
3. **Lint** - Runs ESLint across the repository
4. **Typecheck** - Validates TypeScript types (uses TS project references, no build required)
5. **Build** - Ensures all packages build successfully

**Note**: Typecheck uses TypeScript path mapping (`@tracked/shared` → source) and does not depend on build artifacts. Dependencies are type-checked from source files directly. The `shared` package is configured as `composite` for future build optimizations, but typecheck relies on paths mapping, not references.

### Individual Checks

```bash
# Check workspace only
pnpm verify:workspace

# Check deep imports only
pnpm verify:deep-imports

# Infra helper (prints manual check instructions)
pnpm verify:infra
```

**Note**: `verify:infra` is a helper command that prints instructions for manual infra checks. It does not automatically verify infrastructure status. See "Manual Gates" section below.

## Quality Gates Table

### Automated Gates (via `pnpm verify`)

| Gate             | Command                       | Failure Condition           |
| ---------------- | ----------------------------- | --------------------------- |
| **Workspace**    | `pnpm -r list --depth 0`      | Less than 4 packages found  |
| **Deep Imports** | `rg "@tracked/shared/src" -n` | Any matches found           |
| **Lint**         | `pnpm -w lint`                | ESLint errors (warnings OK) |
| **Typecheck**    | `pnpm -w typecheck`           | TypeScript errors           |
| **Build**        | `pnpm -w build`               | Build failures              |

### Manual Gates (run periodically)

These gates require manual verification and are not automated by `pnpm verify`.

| Gate           | How to Check                                     | Frequency                       |
| -------------- | ------------------------------------------------ | ------------------------------- |
| **API Health** | `curl http://localhost:3001/health`              | Before PR, after conflicts      |
| **Infra Up**   | `docker compose -f infra/docker-compose.yml ps`  | Daily, before integration tests |
| **Bot Start**  | `BOT_TOKEN=... pnpm --filter @tracked/bot start` | After bot changes               |
| **ngrok Loop** | Follow [telegram-dev.md](./telegram-dev.md)      | When testing Mini App           |

**Note**: The `pnpm verify:infra` command is a helper that prints instructions for infra checks. It does not perform automatic verification. Infra gate is **manual only**.

## Failure Handling

### Workspace Failure

**Symptom**: `pnpm -r list --depth 0` shows fewer than 4 packages

**Fix**:

1. Check `pnpm-workspace.yaml` exists and is correct
2. Verify `package.json` in each app/package has correct `name` field
3. Run `pnpm i` to refresh workspace

### Deep Imports Failure

**Symptom**: `rg "@tracked/shared/src" -n` finds matches

**Fix**:

1. Find all matches: `rg "@tracked/shared/src" -n`
2. Replace with `@tracked/shared`
3. Verify imports still work (check exports in `packages/shared/src/index.ts`)

**Example**:

```typescript
// ❌ Wrong
import { ApiEnvSchema } from '@tracked/shared/src/env/schemas';

// ✅ Correct
import { ApiEnvSchema } from '@tracked/shared';
```

### Lint Failure

**Symptom**: ESLint errors (not warnings)

**Fix**:

1. Run `pnpm -w lint:fix` to auto-fix
2. Fix remaining errors manually
3. Note: Warnings are acceptable, only errors block

### Typecheck Failure

**Symptom**: TypeScript compilation errors

**Fix**:

1. Check error messages for type mismatches
2. Fix type definitions or add type assertions
3. Ensure all dependencies are installed: `pnpm i`

### Build Failure

**Symptom**: `pnpm -w build` fails

**Fix**:

1. Check individual package builds: `pnpm --filter @tracked/<package> build`
2. Verify `tsconfig.json` files are correct
3. Check for missing dependencies

## Enforcement

### Cursor Rules

Before starting any new Story:

1. Run `pnpm verify`
2. If red → fix first, stop
3. Never modify unrelated files to make verify pass (scope discipline)

### CI Integration

GitHub Actions CI runs equivalent checks:

- `pnpm -w lint`
- `pnpm -w typecheck`
- `pnpm -w build`

PRs with failing CI cannot be merged.

## Implementation Notes

### Verify Script (`tools/verify/verify.mjs`)

The verification script itself is excluded from ESLint checks to minimize friction during Foundation stage. The script is validated through execution only (via `pnpm verify`), not through static analysis.

**Future improvement**: Re-enable ESLint for `tools/verify` once the ESLint configuration stabilizes.

## Before Starting EPIC 1

**Mandatory checks on `main` branch:**

1. `pnpm verify` → ✅ green
2. GitHub Actions → ✅ green (last run on main)

If both are green, you can proceed with Story 1.1.

## Related Documentation

- [Repository Workflow](./repo-workflow.md) - General workflow rules
- [Telegram Dev](./telegram-dev.md) - Manual gates for Telegram Mini App
- [Local Infra](./local-infra.md) - Infrastructure setup
