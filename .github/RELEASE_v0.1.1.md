# Release v0.1.1 — Foundation hotfix (verify reproducible)

## Fix

**Issue**: `pnpm verify` failed on clean clone because typecheck required pre-built dependencies.

**Solution**: Reorder verify checks - build runs before typecheck.

## Changes

- `tools/verify/verify.mjs`: Build check moved before typecheck
- `docs/runbooks/quality-gates.md`: Updated documentation with new check order

## Verification

Clean clone test:

```bash
git clone --depth 1 --branch v0.1.1 https://github.com/rickonetik/edify.git
cd edify
pnpm i --frozen-lockfile
pnpm verify
```

**Result**: ✅ All quality gates pass

## Technical Note

Typecheck currently relies on build artifacts (temporary compromise for Foundation stage). Preferred future: TS project references / path mapping to source for typecheck without build.

## Version History

- `v0.1.0` — Foundation initial (may have clean clone issues)
- `v0.1.1` — Foundation hotfix (verify reproducible) ← **Use this for rollback**
