# Story 5.3 — Expert gating by subscription status

**Purpose**: Restrict access to ExpertModule (/experts/:expertId/...) by expert_subscriptions: active + current_period_end not in past → OK; inactive/expired or period ended → 403 EXPERT_SUBSCRIPTION_INACTIVE + audit subscription.denied.expert_subscription_inactive with trace_id = x-request-id. Membership deny (EXPERT_MEMBERSHIP_REQUIRED) happens before subscription deny.

**Artifacts**: No passwords, no absolute paths. Env vars and IDs below are placeholders only (no `/Users/...`, no real DATABASE_URL/host, no `.env*`, `dist/**`, `debug/**`).  
**CI**: `.github/workflows/ci.yml` sets `DATABASE_URL` and `JWT_ACCESS_SECRET`, so `pnpm test:foundation` runs all suites (including api.subscriptions.gating); no skip.

## Definition of Done

- [x] Any /experts/:expertId/\*: when expert_subscriptions.status != active or period_end <= now → 403 EXPERT_SUBSCRIPTION_INACTIVE
- [x] Audit subscription.denied.expert_subscription_inactive with trace_id = x-request-id
- [x] RBAC precedence: user without membership gets EXPERT_MEMBERSHIP_REQUIRED, not subscription error
- [x] Gates: pnpm verify, pnpm test:foundation, pnpm audit:architecture ✅
- [x] No changes in apps/webapp/**, no .env\*, no dist/**

## A) Gates

Порядок (строго с переносами строк, не склеивать команды):

```bash
pnpm verify
```

```bash
DATABASE_URL="<your DATABASE_URL with correct port>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation
```

```bash
pnpm audit:architecture
```

При необходимости сначала поднять инфру и проверить порт Postgres (часто 5433):

```bash
pnpm infra:up
```

```bash
docker ps | grep postgres
```

В DATABASE_URL — только плейсхолдеры, без живых URL/паролей/путей.

В CI порт не конфликтует; ошибка про 3001 актуальна только для локального прогона. Если упало из-за 3001 — см. PR_ARTIFACTS_STORY_5.3.md §2.

**Expected**: All pass, including api.subscriptions.gating and api.expert-rbac.tenancy (RBAC tests with subscription activated in setup).

## B) SQL proof (placeholders)

Replace `<trace-id>` with value from your smoke (e.g. x-request-id from request).

### audit_log by trace_id (subscription deny)

```sql
SELECT created_at, action, trace_id, meta
FROM audit_log
WHERE trace_id = '<trace-id>'
ORDER BY created_at DESC;
```

**Expected**: Row for `subscription.denied.expert_subscription_inactive` when member with inactive subscription calls /experts/:expertId/ping; proof строго по фильтру `trace_id` (без «последние 10 строк», без пустых trace_id).

## C) Manual smoke (placeholders only)

1. Start infra and API (env: `DATABASE_URL`, `JWT_ACCESS_SECRET` — placeholders; no secrets in runbook).

2. Create expert and add support member (e.g. via POST /admin/experts, POST /admin/experts/:id/members). Do **not** call grant-days. Get `<support-jwt>` and `<expert-id>`.

3. Call ping as support member (subscription default inactive):

   ```bash
   curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/experts/<expert-id>/ping" \
     -H "Authorization: Bearer <support-jwt>" \
     -H "x-request-id: trace-<uuid>"
   ```

   **Expected**: 403. Response body: code=EXPERT_SUBSCRIPTION_INACTIVE.

4. As platform owner, grant days: POST /admin/experts/:expertId/subscription/grant-days { days: 30 }. Then call ping again as support member. **Expected**: 200.

5. As platform owner, expire: POST /admin/experts/:expertId/subscription/expire. Then call ping again as support member. **Expected**: 403 EXPERT_SUBSCRIPTION_INACTIVE.

6. User without membership → GET /experts/:expertId/ping. **Expected**: 403 EXPERT_MEMBERSHIP_REQUIRED (not subscription error).

### Manual smoke summary

| Step | Request / condition                              | Expected                         |
| ---- | ------------------------------------------------ | -------------------------------- |
| 1    | Support member, subscription inactive → GET ping | 403 EXPERT_SUBSCRIPTION_INACTIVE |
| 2    | Owner → grant-days, then support → GET ping      | 200                              |
| 3    | Owner → expire, then support → GET ping          | 403 EXPERT_SUBSCRIPTION_INACTIVE |
| 4    | User without membership → GET ping               | 403 EXPERT_MEMBERSHIP_REQUIRED   |

## Summary

| Item                    | Location / Check                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Error code              | packages/shared/src/errors/codes.ts (EXPERT_SUBSCRIPTION_INACTIVE)                                                      |
| Guard                   | apps/api/src/subscriptions/guards/expert-subscription.guard.ts                                                          |
| Subscriptions module    | apps/api/src/subscriptions/subscriptions.module.ts                                                                      |
| Expert controller       | apps/api/src/modules/expert/expert.controller.ts (guards order: JwtAuthGuard, ExpertRoleGuard, ExpertSubscriptionGuard) |
| Foundation gating tests | tools/tests/foundation/api.subscriptions.gating.test.mjs                                                                |
| Foundation RBAC tests   | tools/tests/foundation/api.expert-rbac.tenancy.test.mjs (subscription activated in setup)                               |
