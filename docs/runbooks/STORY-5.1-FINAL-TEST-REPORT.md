# Story 5.1 — Subscription model (free stub) + default row on expert create

**Purpose**: Verify expert_subscriptions table (migration 006), shared contracts, default subscription row on POST /admin/experts, and foundation gates.

**Artifacts**: No passwords, no absolute paths. Env vars below are placeholders (e.g. `<your DATABASE_URL>`, `<test secret (>=16 chars)>`).  
**CI**: `.github/workflows/ci.yml` sets `DATABASE_URL` and `JWT_ACCESS_SECRET`, so `pnpm test:foundation` runs all suites (including `applied_migrations has 006_*` and subscription default row test); no skip.

## Definition of Done

- [ ] Migration 006 applied and reflected in applied_migrations after API start
- [ ] Table expert_subscriptions exists with plan, status, price_cents, period columns
- [ ] POST /admin/experts creates default expert_subscriptions row (plan=free_stub, status=inactive, price_cents=0, period null)
- [ ] Shared contracts: ExpertSubscriptionV1, ExpertSubscriptionPlanV1, ExpertSubscriptionStatusV1 + Zod schemas
- [ ] All gates PASS: `pnpm verify`, `pnpm test:foundation`, `pnpm audit:architecture`
- [ ] No changes in apps/webapp/\*\*, no gating/403 by subscription (Story 5.3), no admin grant/expire (Story 5.2)
- [ ] This runbook filled after manual verification

## A) Gates

```bash
pnpm verify
pnpm audit:architecture
```

```bash
pnpm infra:up
DATABASE_URL="<your DATABASE_URL>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation
```

**Note**: If `docker ps` shows Postgres mapped to `0.0.0.0:5433->5432/tcp`, use `localhost:5433` in `DATABASE_URL` (not 5432).

**Expected**: All pass, including `applied_migrations has 006_*` and `admin creates expert → expert_subscriptions row exists with defaults`.

## B) DB proof

Use the **same** `DATABASE_URL` (placeholder in runbook; set locally or in CI) for `psql` and for the API.

### applied*migrations (006*\*)

```sql
SELECT name FROM applied_migrations ORDER BY applied_at DESC LIMIT 10;
```

**Expected**: Row for `006_add_expert_subscriptions`.

### expert_subscriptions

```sql
SELECT expert_id, plan, status, price_cents, current_period_start, current_period_end
FROM expert_subscriptions
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: Table exists; after creating an expert via POST /admin/experts, a row appears with plan='free_stub', status='inactive', price_cents=0, current_period_start NULL, current_period_end NULL.

## C) Manual smoke: create expert → subscription default

1. Start infra and API (env: `DATABASE_URL`, `JWT_ACCESS_SECRET` — use placeholders; no secrets in runbook).
2. Create expert:
   ```bash
   curl -X POST http://localhost:3001/admin/experts \
     -H "Authorization: Bearer <JWT>" \
     -H "Content-Type: application/json" \
     -d '{"title":"My Expert","ownerUserId":"<owner-user-uuid>"}'
   ```
   **Expected**: 201 with `{ "id": "<uuid>" }`.
3. Proof in DB (replace `<expert-id-from-response>` with the id from step 2):
   ```sql
   SELECT plan, status, price_cents, current_period_start, current_period_end
   FROM expert_subscriptions
   WHERE expert_id = '<expert-id-from-response>';
   ```
   **Expected**: plan='free*stub', status='inactive', price_cents=0, current_period*\* IS NULL.

## Summary

| Item                     | Location / Check                                        |
| ------------------------ | ------------------------------------------------------- |
| Migration 006            | infra/migrations/006_add_expert_subscriptions.sql       |
| Shared contracts         | packages/shared/src/contracts/v1/subscription.ts        |
| API subscriptions module | apps/api/src/subscriptions/                             |
| Hook on expert create    | AdminExpertsController createExpert → ensureDefault     |
| Foundation tests         | tools/tests/foundation/api.subscriptions.model.test.mjs |
