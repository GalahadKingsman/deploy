# @tracked/shared

Shared package for tracked-lms monorepo.

## Purpose

This package provides:

- **Environment validation** (`env/`) - Zod schemas and validation utilities
- **Error types** (`errors/`) - Standardized error codes and API error response types
- **Contracts** (`contracts/`) - Shared TypeScript interfaces and types

## Public API

All public exports are available from the package root:

```typescript
import { ApiEnvSchema, validateOrThrow } from '@tracked/shared';
import { ErrorCodes, ApiErrorResponse } from '@tracked/shared';
import { PaginationQuery, Paginated } from '@tracked/shared';
```

### Modules

- `env` - Environment variable schemas and validation
- `errors` - Error codes and API error response types
- `contracts` - Shared TypeScript contracts (pagination, etc.)

## Rules

### ❌ Do NOT import from `src/`

**Forbidden:**

```typescript
import { something } from '@tracked/shared/src/env/schemas'; // ❌
```

**Correct:**

```typescript
import { ApiEnvSchema } from '@tracked/shared'; // ✅
```

### ✅ Adding new contracts

1. Add new contracts to `src/contracts/` (create subdirectories as needed)
2. Export from `src/contracts/index.ts`
3. Re-export from root `src/index.ts`
4. Use from package root: `import { NewContract } from '@tracked/shared'`

### Structure

```
src/
  index.ts          # Public API entry point
  env/
    index.ts        # Public env exports
    schemas.ts      # Zod schemas
    validate.ts     # Validation utilities
  errors/
    index.ts        # Public error exports
    codes.ts        # Error code constants
    types.ts        # Error type definitions
  contracts/
    index.ts        # Public contract exports
    common/
      index.ts      # Common contracts
      pagination.ts # Pagination types
```

## Development

```bash
# Build
pnpm --filter @tracked/shared build

# Typecheck
pnpm --filter @tracked/shared typecheck

# Lint
pnpm --filter @tracked/shared lint
```
