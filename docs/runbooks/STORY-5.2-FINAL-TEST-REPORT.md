# Story 5.2 — Admin endpoints: grant N days / expire for expert_subscriptions (free stub)

**Purpose**: Verify POST grant-days and POST expire (owner-only), audit with trace_id, foundation gates.

**Artifacts**: No passwords, no absolute paths. Env vars and IDs below are placeholders only (no `/Users/...`, no real DATABASE_URL/host, no `.env*`, `dist/**`, `debug/**`).  
**CI**: `.github/workflows/ci.yml` sets `DATABASE_URL` and `JWT_ACCESS_SECRET`, so `pnpm test:foundation` runs all suites (including api.subscriptions.admin); no skip.

## Definition of Done

- [ ] POST /admin/experts/:expertId/subscription/grant-days (owner) → 200, subscription active, period set/extended
- [ ] POST /admin/experts/:expertId/subscription/expire (owner) → 200, subscription expired, end = now
- [ ] admin (not owner) on both endpoints → 403 FORBIDDEN_PLATFORM_ROLE
- [ ] EXPERT_NOT_FOUND on non-existent expertId
- [ ] Audit entries with trace_id = x-request-id: admin.expert_subscription.grant_days, admin.expert_subscription.expire
- [ ] Gates: pnpm verify, pnpm test:foundation, pnpm audit:architecture ✅
- [ ] No changes in apps/webapp/**, no .env\*, no dist/**

## A) Gates

Строго с переносами строк (не склеивать команды):

```bash
pnpm verify

DATABASE_URL="<your DATABASE_URL>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation

pnpm audit:architecture
```

При необходимости сначала: `pnpm infra:up` (тот же `DATABASE_URL` для API и тестов).

**Expected**: All pass, including api.subscriptions.admin tests (grant-days, expire, 403, 404, validation, audit).

## B) SQL proof (placeholders)

Replace `<expertId>` and `<trace-id>` with values from your smoke (e.g. expert id from response, x-request-id from curl).

### expert_subscriptions

```sql
SELECT * FROM expert_subscriptions WHERE expert_id = '<expertId>';
```

**Expected**: After grant-days: status='active', current_period_end set. After expire: status='expired', current_period_end ≈ now.

### audit_log by trace_id

```sql
SELECT created_at, action, trace_id, meta
FROM audit_log
WHERE trace_id = '<trace-id>'
ORDER BY created_at DESC;
```

**Expected**: Rows for `admin.expert_subscription.grant_days` and/or `admin.expert_subscription.expire`; proof строго по фильтру `trace_id` (без «последние 10 строк», без пустых trace_id).

## C) Manual smoke (curl, placeholders only)

1. Start infra and API (env: `DATABASE_URL`, `JWT_ACCESS_SECRET` — placeholders; no secrets in runbook).

2. Create owner user and expert (e.g. via DB or POST /admin/experts). Get `<owner-jwt>` and `<expert-id>`.

3. Grant days:

   ```bash
   curl -X POST "http://localhost:3001/admin/experts/<expert-id>/subscription/grant-days" \
     -H "Authorization: Bearer <owner-jwt>" \
     -H "Content-Type: application/json" \
     -H "x-request-id: trace-<uuid>" \
     -d '{"days": 30}'
   ```

   **Expected**: 200, JSON matches ExpertSubscriptionV1 (status=active, currentPeriodEnd set).

4. Expire:

   ```bash
   curl -X POST "http://localhost:3001/admin/experts/<expert-id>/subscription/expire" \
     -H "Authorization: Bearer <owner-jwt>" \
     -H "x-request-id: trace-<uuid>"
   ```

   **Expected**: 200, JSON status=expired, currentPeriodEnd ≈ now.

5. Admin (non-owner) → grant-days: **Expected** 403 FORBIDDEN_PLATFORM_ROLE.

### Manual smoke summary

| Step | Request                                      | Expected                                    |
| ---- | -------------------------------------------- | ------------------------------------------- |
| 1    | Owner token → POST grant-days (e.g. days=30) | 200, ExpertSubscriptionV1, status=active    |
| 2    | Owner token → POST expire                    | 200, status=expired, currentPeriodEnd ≈ now |
| 3    | Admin token → POST grant-days                | 403 FORBIDDEN_PLATFORM_ROLE                 |

## Summary

| Item                    | Location / Check                                              |
| ----------------------- | ------------------------------------------------------------- |
| Repository grant/expire | apps/api/src/subscriptions/expert-subscriptions.repository.ts |
| Admin controller        | apps/api/src/modules/admin/admin.subscriptions.controller.ts  |
| Foundation tests        | tools/tests/foundation/api.subscriptions.admin.test.mjs       |
