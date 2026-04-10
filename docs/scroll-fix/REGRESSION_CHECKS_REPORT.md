# Regression Checks Report: 6 Critical Tests

## ✅ Check 1: Dev Routes Not Available in Production

### Code Analysis

- **Status**: ✅ **LOGIC CORRECT**
- **Implementation**:
  - `devRoutes.tsx`: `getDevRoutes()` returns `[]` if `!import.meta.env.DEV`
  - `router.tsx`: `devRoutes = import.meta.env.DEV ? await getDevRoutes() : []`
  - Routes array: `[...productionRoutes, ...devRoutes]` - in prod, `devRoutes` is empty array

### Expected Behavior

- `/_ui-preview`, `/_layout-test`, `/_scroll-test` should return **404 Not Found** (react-router default)
- Not empty page, not silent redirect

### Manual Test Required

```bash
pnpm --filter @tracked/webapp build
pnpm --filter @tracked/webapp preview
# Then manually open:
# http://localhost:4173/_ui-preview
# http://localhost:4173/_layout-test
# http://localhost:4173/_scroll-test
```

**Expected**: All return 404 page (react-router's default 404 handler)

---

## ✅ Check 2: Swagger Test Timeouts Actually Apply

### Code Analysis

- **Status**: ✅ **IMPLEMENTED**
- **Implementation**:
  - `PORT_TIMEOUT = 15000ms` (15 seconds)
  - `STARTUP_TIMEOUT = 30000ms` (30 seconds)
  - `waitForPort()` throws error after timeout with last error message
  - Test timeouts: `t.timeout = STARTUP_TIMEOUT + 10000` (40 seconds total)

### Expected Behavior

- If server doesn't start: test fails after ~15-30 seconds
- Error message includes last error context
- No infinite hanging

### Manual Test Required

Temporarily modify `waitForPort()` to use wrong port:

```javascript
const response = await fetch(`http://localhost:9999/health`); // Wrong port
```

**Expected**: Test fails after ~15 seconds with readable error

---

## ✅ Check 3: Scroll Storage Cleanup

### Code Analysis

- **Status**: ✅ **IMPLEMENTED**
- **Implementation**:
  - `SCROLL_STORAGE_LIMIT = 50`
  - `cleanupOldScrollKeys()` called on every `saveScrollPosition()`
  - Logic: sorts keys, removes oldest (first `length - 50`)

### Potential Issues

- ✅ Cleanup runs on every save (could be optimized, but safe)
- ✅ Keys sorted alphabetically (deterministic)
- ✅ Values saved as `String(value)` - should be numbers only

### Manual Test Required

1. Navigate actively for 1-2 minutes (many routes)
2. Check `sessionStorage`:
   ```javascript
   Object.keys(sessionStorage).filter((k) => k.startsWith('scroll-')).length;
   ```
   **Expected**: ≤ 50 keys
3. Check values:
   ```javascript
   Object.keys(sessionStorage)
     .filter((k) => k.startsWith('scroll-'))
     .map((k) => sessionStorage.getItem(k))
     .every((v) => !isNaN(Number(v)) && Number.isFinite(Number(v)));
   ```
   **Expected**: All values are valid numbers (no NaN, undefined)

---

## ✅ Check 4: Edge Case - Direct Entry to Stub

### Code Analysis

- **Status**: ✅ **FIXED**
- **Implementation**: Added fallback in `StubLayout.handleBack()`:
  ```typescript
  if (window.history.length <= 1) {
    navigate('/learn', { replace: true });
  } else {
    navigate(-1);
  }
  ```
- **Rationale**: Prevents closing WebView or unexpected behavior when history is empty

### Expected Behavior

- If history is empty (direct entry): Navigates to `/learn` with `replace: true`
- If history exists: Uses `navigate(-1)` as before
- **Should NOT**: crash, infinite redirects, or close WebView

### Manual Test Required

1. Open new tab → navigate directly to `/updates/123`
2. Press "Назад" button in UI
3. **Expected**: Navigates to `/learn` (not closing WebView)

---

## ⚠️ Check 5: Tab Switch While Scrolled + Fast Back

### Code Analysis

- **Status**: ⚠️ **NEEDS MANUAL VERIFICATION**
- **Scenario**:
  1. `/learn` → scroll down
  2. Tap `/library` tab
  3. Immediately press Back
- **Scrollable Logic**:
  - Tabs use `pathname` as scroll key (stable)
  - `prevScrollKeyRef` tracks previous key
  - Save happens in `useLayoutEffect` when `scrollKey` changes
  - Restore happens in separate `useLayoutEffect`

### Potential Race Condition

- If Back is pressed very quickly:
  - `/learn` → `/library` (save `/learn` scroll)
  - `/library` → `/learn` (restore `/learn` scroll)
  - Timing: both `useLayoutEffect` hooks run, but order matters

### Manual Test Required (in WebView)

1. `/learn` → scroll down significantly
2. Tap `/library` tab
3. **Immediately** press Back (< 500ms)
4. **Expected**:
   - `/learn` returns with restored scroll position
   - No flickering (no flash of top, then jump to saved position)
   - No jump to 0

---

## ✅ Check 6: Performance on Weak Device

### Code Analysis

- **Status**: ✅ **OPTIMIZED**
- **Previous Implementation**:
  - `cleanupOldScrollKeys()` ran on every `saveScrollPosition()` call
  - O(n) operation on every scroll event (60+ times/second)
- **New Implementation**:
  - `saveScrollPosition()` only does `sessionStorage.setItem()` (fast)
  - `cleanupOldScrollKeys()` called only in:
    - `pagehide` event (before page unload)
    - `unmount` cleanup (component unmount)
  - **Result**: Cleanup runs ~2 times per navigation, not 60+ times per second

### Expected Behavior

- Fast scroll on long page: no noticeable lag (cleanup doesn't run during scroll)
- Cleanup happens when needed (pagehide/unmount)
- Storage still limited to 50 keys

### Manual Test Required (on Android/throttled device)

1. Long page (many courses in `/learn`)
2. Fast scroll (flick gesture)
3. **Expected**: No stuttering, smooth scroll (improved from previous version)

### Additional Optimization (if still needed)

If lag persists, add RAF batching for saves:

```typescript
let rafId: number | null = null;
const onScroll = () => {
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      save();
      rafId = null;
    });
  }
};
```

---

## Summary

| Check                     | Status                  | Action Required                         |
| ------------------------- | ----------------------- | --------------------------------------- |
| 1. Dev routes in prod     | ✅ Logic correct        | Manual test: verify 404                 |
| 2. Test timeouts          | ✅ Implemented          | Manual test: simulate failure           |
| 3. Storage cleanup        | ✅ Implemented + Tested | Automated test passes                   |
| 4. Direct stub entry      | ✅ Fixed                | Manual test: verify fallback works      |
| 5. Tab switch + fast back | ⚠️ Needs verification   | Manual test: in WebView                 |
| 6. Performance            | ✅ Optimized            | Manual test: fast scroll on weak device |

## Recommendations

1. **Check 1-2**: Can be automated in CI (verify 404, test timeout)
2. **Check 3**: ✅ **Automated** - `webapp.scroll.test.mjs` tests cleanup logic
3. **Check 4**: ✅ **Fixed** - Fallback for empty history implemented
4. **Check 5**: Require manual testing in WebView (browser behavior)
5. **Check 6**: ✅ **Optimized** - Cleanup moved to pagehide/unmount

## Automated Tests

Created `tools/tests/foundation/webapp.scroll.test.mjs`:

- ✅ Tests `cleanupOldScrollKeys` logic (removes oldest when >50 keys)
- ✅ Tests cleanup does nothing when ≤50 keys
- ✅ Tests edge case (exactly 50 keys)

Run: `node tools/tests/foundation/webapp.scroll.test.mjs`
