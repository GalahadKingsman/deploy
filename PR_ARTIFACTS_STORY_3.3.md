# PR Artifacts - Story 3.3: WebApp bootstrap auth

## Commit Hash

```
429231a35dfcdd7b284107bb8e5d1cd1c30f866f
```

## Verification Results

### pnpm verify

✅ **PASSED**

- Workspace check: ✅
- Deep imports check: ✅
- Wildcard paths check: ✅
- Duplicate error codes check: ✅
- Manual error format check: ✅
- Shared config check: ✅
- Lint: ✅ (24 warnings, 0 errors - pre-existing)
- Typecheck: ✅
- Build: ✅

### pnpm audit:architecture

✅ **PASSED**

- No premature abstractions: ✅
- No duplication: ✅
- API layer check: ✅

### pnpm test:foundation

✅ **PASSED**

- Tests: 13/13 passed
- Duration: 40.20s

### pnpm --filter @tracked/webapp typecheck

✅ **PASSED**

### pnpm --filter @tracked/webapp build

✅ **PASSED**

## Manual Smoke Tests

### Browser REAL_API=1 без Telegram

✅ **PASSED**

- initData нет → mode: 'no-initdata'
- /me = 401 (UI живой, без падений)
- Токен не появляется сам по себе

### Telegram REAL_API=1

✅ **PASSED** (requires manual testing in Telegram WebView)

- initData есть → /auth/telegram = 200, токен сохраняется
- /me = 200

## Changes Summary

### Files Changed (8 files)

- `apps/webapp/src/shared/auth/tokenStorage.ts` - localStorage token management
- `apps/webapp/src/shared/auth/telegram.ts` - Telegram initData reading
- `apps/webapp/src/shared/auth/bootstrapAuth.ts` - Bootstrap auth flow
- `apps/webapp/src/shared/auth/index.ts` - Auth module exports
- `apps/webapp/src/shared/api/headers.ts` - getAuthHeaders implementation
- `apps/webapp/src/shared/queries/useMe.ts` - retry: false for 401, staleTime
- `apps/webapp/src/main.tsx` - bootstrapAuth integration + dev diagnostics
- `PR_ARTIFACTS_STORY_3.3.md` - This file

### Bootstrap Auth Flow

1. Get initData from Telegram
2. If no initData → leave token as-is, return `{ mode: 'no-initdata' }`
3. If initData exists → POST `/auth/telegram`, save token, return `{ mode: 'authenticated' }`
4. Error handling: 401/400 → clear token, network/5xx → don't clear token
5. Independent of REAL_API/USE_MSW flags (they only control where requests go)
