# Release v0.1.2 — Foundation hotfix (typecheck without build)

## Fix

**Issue**: Typecheck required build artifacts, breaking clean clone reproducibility.

**Solution**: Use TypeScript path mapping (`@tracked/shared` → source) instead of project references for typecheck.

## Changes

- `packages/shared/tsconfig.json`: Configured as composite (for future build optimization)
- `tsconfig.base.json`: Added path mapping `@tracked/shared` → `packages/shared/src/index.ts`
- `apps/api/tsconfig.json`, `apps/bot/tsconfig.json`: Removed references, rely on paths
- `tools/verify/verify.mjs`:
  - Restored order: typecheck before build
  - Added wildcard paths check (prevents `@tracked/shared/*` in tsconfig)
- `.cursor/rules/rules.mdc`: Added rule prohibiting wildcard paths

## Verification

Clean clone test:

```bash
git clone --depth 1 --branch v0.1.2 https://github.com/rickonetik/edify.git
cd edify
pnpm i --frozen-lockfile
pnpm verify
```

**Result**: ✅ All quality gates pass

## Technical Notes

### Path Mapping vs References

- **Typecheck**: Uses path mapping (`@tracked/shared` → source) - no build required
- **Runtime**: Uses built package (`@tracked/shared` → `dist/index.js`)
- **Shared package**: Configured as `composite` for future build optimizations

### Rules

1. **No wildcard paths**: `@tracked/shared/*` is forbidden in tsconfig
2. **No deep imports**: `@tracked/shared/src/*` is forbidden in code
3. **Shared must remain pure**: Only contracts, errors, env schemas, minimal utilities (no node-only APIs)

## Version History

- `v0.1.0` — Foundation initial
- `v0.1.1` — Foundation hotfix (verify reproducible with build→typecheck)
- `v0.1.2` — Foundation hotfix (typecheck without build) ← **Use this for rollback**
