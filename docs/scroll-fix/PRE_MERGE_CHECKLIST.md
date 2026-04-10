# Pre-Merge Checklist: Scroll Fix & Code Cleanup

## ✅ Completed Fixes

### 1. Dev-only Routes (Tree-shaken in Production)

- **Status**: ✅ **PASSED**
- **Implementation**: Dev routes moved to separate `devRoutes.tsx` module
- **Verification**:
  - ✅ `grep` in `dist/assets/*.js`: No mentions of `_ui-preview`, `_layout-test`, `_scroll-test`
  - ✅ Production routes defined first, dev routes appended at the end
  - ✅ `import.meta.env.DEV` check ensures tree-shaking works
- **Target**: ES2020 (supports top-level await via Vite/ESBuild)
- **Order**: Production routes matched first, dev routes don't interfere

### 2. Test Timeouts (Deterministic Failures)

- **Status**: ✅ **FIXED**
- **Changes**:
  - ✅ `api.swagger.test.mjs`: Added explicit test timeouts (`t.timeout = STARTUP_TIMEOUT + 10000`)
  - ✅ `waitForPort()`: Improved error messages with last error context
  - ✅ All tests have `PORT_TIMEOUT = 15000ms` and `STARTUP_TIMEOUT = 30000ms`
- **Behavior**: Tests now fail with clear error messages instead of hanging indefinitely

### 3. Scrollable.tsx (Query Params Handling)

- **Status**: ✅ **VERIFIED**
- **Implementation**:
  - ✅ Tabs use `pathname` only (query params ignored): `/learn` and `/learn?state=loading` share same scroll key
  - ✅ Non-tabs use `location.key` (unique per navigation entry)
  - ✅ Cleanup limits scroll keys to 50 entries
- **Comment added**: Clarifies that query params are intentionally ignored for tabs

## 🧪 Manual Test Scenarios (5 Critical Checks)

Before merge, verify these scenarios in Telegram WebView:

### A. Basic Scroll Restore

1. Navigate to `/learn`
2. Scroll down
3. Click a course card (navigate to stub)
4. Press back
5. **Expected**: Scroll position restored (not at top)

### B. Tab Switching

1. Navigate to `/learn`
2. Scroll down
3. Switch to `/library` tab
4. Switch back to `/learn` tab
5. **Expected**: Scroll position restored

### C. Query Params (State Changes)

1. Navigate to `/learn?state=loading`
2. Wait for state to change to normal (query param removed)
3. **Expected**: No unexpected scroll restore, stays at top

### D. Stub Navigation

1. Navigate to `/updates/:id` (stub page)
2. Press back
3. **Expected**: Tab activity and scroll restore work correctly

### E. Rapid Tab Switching

1. Quickly switch between `/learn`, `/library`, `/account` 10-15 times
2. **Expected**: No "jitter" or unexpected scroll jumps

## 📋 Final Commands

```bash
# 1. Lint (should pass with only warnings)
pnpm lint

# 2. Build (should succeed)
pnpm build

# 3. Verify tree-shake (should show no dev routes)
grep -r "_ui-preview\|_layout-test\|_scroll-test" apps/webapp/dist/assets/*.js || echo "✓ Tree-shake confirmed"

# 4. Type check
pnpm --filter @tracked/webapp typecheck

# 5. Run tests (with timeouts)
node tools/tests/foundation/api.health.test.mjs
node tools/tests/foundation/api.errors.test.mjs
node tools/tests/foundation/api.swagger.test.mjs
```

## 📝 Notes

- **Documentation**: All `.md` files moved from `apps/webapp/src/pages/__tests__/` to `docs/scroll-fix/`
- **Test files**: `.mjs` files remain in `__tests__/` (excluded from lint via `eslint.config.mjs`)
- **Dev routes**: Safely excluded from production bundle via Vite tree-shaking
- **Test timeouts**: All tests now have deterministic timeouts and fail gracefully

## ⚠️ Known Limitations

- `location.key` can create many scroll keys for frequent navigation (mitigated by 50-key cleanup limit)
- Query params are intentionally ignored for tabs (by design, to maintain scroll across state changes)
