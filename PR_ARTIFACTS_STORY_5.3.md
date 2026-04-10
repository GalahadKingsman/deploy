# PR 5.3 — Артефакты для merge (Expert gating by subscription status)

## 1. Stdout: pnpm verify

```
> tracked-lms@0.x.x verify <workspace>
> node tools/verify/verify.mjs

🚀 Quality Gates Verification
...
✨ All quality gates passed!
```

_(Placeholder: run `pnpm verify` locally or in CI; paste actual output. No `/Users/...`, no postgresql://..., no passwords.)_

---

## 2. Почему упал pnpm test:foundation и как чинить

**Причина**: порт **3001** занят внешним процессом, тестовый старт API не происходит → `Port 3001 still in use after 8000ms`.

**Mac: кто занял 3001**

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

**Аккуратно остановить (предпочтительно)**  
Если это твой `pnpm dev:*` — останови тот терминал (Ctrl+C).

**Жёстко убить процесс, если «залип»**

```bash
lsof -ti tcp:3001 | xargs kill -9
```

**Проверка, что порт свободен**

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN || echo "3001 is free"
```

Ожидание: `3001 is free`.

---

## 3. Правильный локальный прогон foundation с DB (без сюрпризов)

1. **Поднять инфру**

```bash
pnpm infra:up
```

2. **Проверить порт Postgres** (часто 5433):

```bash
docker ps | grep postgres
```

3. **Запустить тесты с корректным DATABASE_URL (порт!)**

```bash
DATABASE_URL="<your DATABASE_URL with correct port>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation
```

Без живых URL/паролей/путей: только плейсхолдеры в команде выше (не подставлять postgresql://..., не localhost:5433 как данные, не /Users/...).

**Ожидание**:

- все suite, зависящие от DB, **не skip**;
- api.subscriptions.gating.test.mjs выполняется;
- deny по подписке пишет audit с trace_id = x-request-id;
- **PASS** по всему набору.

---

## 4. Stdout: pnpm test:foundation (с DB)

_(После прогона из п.3 — зафиксировать stdout сюда. Без паролей, без абсолютных путей.)_

```bash
DATABASE_URL="<your DATABASE_URL with correct port>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation
```

**Actual stdout (sanitized: no real URLs/paths):**

```
> tracked-lms@0.4.4 test:foundation <workspace>
> node --test --test-concurrency=1 tools/tests/foundation/*.test.mjs

[API stderr] [migrations] MIGRATIONS_DIR=<repo>/infra/migrations
✔ user → GET /admin/audit returns 403 FORBIDDEN_PLATFORM_ROLE
✔ admin → GET /admin/audit?limit=10 → 200, valid schema
✔ admin → GET /admin/audit?cursor=invalid → 400 VALIDATION_ERROR
✔ filter traceId: write audit then GET /admin/audit?traceId=<known>
✔ cursor pagination: page1 then page2, no overlap by id
✔ admin → GET /admin/audit/actions → 200, items includes rbac.denied
✔ GET /nope returns 404 with unified error format
✔ GET /health/400 returns 400 with validation error format
[API stderr] [migrations] MIGRATIONS_DIR=<repo>/infra/migrations
✔ applied_migrations contains 004
✔ user without membership → GET /experts/:expertId/ping = 403 EXPERT_MEMBERSHIP_REQUIRED + audit rbac.denied.expert_membership trace_id
✔ support member → GET /experts/:expertId/ping = 200
✔ support member → GET /experts/:expertId/admin-ping = 403 FORBIDDEN_EXPERT_ROLE + audit rbac.denied.expert_role
✔ manager member → GET /experts/:expertId/admin-ping = 200
✔ audit deny meta contains expertId, requiredRole, userRole, path, method
✔ trace_id in audit matches x-request-id
✔ manager member → GET /experts/:expertId/ping = 200
[API stderr] [migrations] MIGRATIONS_DIR=<repo>/infra/migrations
✔ user → POST /admin/experts returns 403 FORBIDDEN_PLATFORM_ROLE + audit deny by trace_id
✔ admin → POST /admin/experts returns 201 + expert and owner member created in DB
✔ admin → POST /admin/experts/:id/members add member → 200 + audit admin.expert.member.add
✔ admin → repeat add same member → 409 EXPERT_MEMBER_ALREADY_EXISTS
✔ admin → PATCH member role → 200 + audit admin.expert.member.role.set
✔ admin → DELETE member → 200 + audit admin.expert.member.remove
✔ admin → add member to non-existent expert → 404 EXPERT_NOT_FOUND
✔ admin → PATCH member when not exists → 404 EXPERT_MEMBER_NOT_FOUND
✔ admin → DELETE member when not exists → 404 EXPERT_MEMBER_NOT_FOUND
✔ admin → add member with invalid role → 400 INVALID_EXPERT_MEMBER_ROLE
✔ GET /health returns 200 with correct format
✔ GET /health includes x-request-id header
✔ GET /me without auth returns 401 with unified error format
✔ GET /me with invalid token returns 401 unified error (NOT 500)
[API stderr] [migrations] MIGRATIONS_DIR=<repo>/infra/migrations
✔ applied_migrations has 003_* and 004_* after API start
✔ user → GET /admin/ping returns 403 FORBIDDEN_PLATFORM_ROLE
✔ audit rbac.denied.platform_role with trace_id = x-request-id
✔ admin → GET /admin/ping returns 200 { ok: true }
✔ owner → POST /admin/users/:id/platform-role sets target to admin + audit
✔ admin → POST /admin/users/:id/platform-role returns 403 FORBIDDEN_PLATFORM_ROLE
[API stderr] [migrations] MIGRATIONS_DIR=<repo>/infra/migrations
✔ admin (platform_role=admin) → grant-days → 403 FORBIDDEN_PLATFORM_ROLE
✔ owner → grant-days days=30 → 200, ExpertSubscriptionV1 schema, DB status=active
✔ owner → grant-days twice (10 then 5) → End2 > End1
✔ owner → expire → 200, DB status=expired
✔ invalid days: days=0 → 400 VALIDATION_ERROR
✔ expert not found: owner → grant-days on random UUID → 404 EXPERT_NOT_FOUND
✔ audit: grant-days writes admin.expert_subscription.grant_days with trace_id = x-request-id
✔ audit: expire writes admin.expert_subscription.expire with trace_id = x-request-id
[API stderr] [migrations] MIGRATIONS_DIR=<repo>/infra/migrations
✔ support member, subscription inactive (default) → GET /experts/:expertId/ping = 403 EXPERT_SUBSCRIPTION_INACTIVE
✔ audit: subscription.denied.expert_subscription_inactive by trace_id = x-request-id
✔ owner grants days → GET /experts/:expertId/ping = 200
✔ owner expire → GET /experts/:expertId/ping = 403 EXPERT_SUBSCRIPTION_INACTIVE
✔ user without membership → GET /experts/:expertId/ping = 403 EXPERT_MEMBERSHIP_REQUIRED (membership before subscription)
[API stderr] [migrations] MIGRATIONS_DIR=<repo>/infra/migrations
✔ applied_migrations has 006_* after API start
✔ admin creates expert → expert_subscriptions row exists with defaults
✔ GET /docs returns 200 in development mode
✔ GET /docs returns 404 with error format in production mode
✔ SWAGGER_ENABLED parsing: "0" and "false" are falsy
✔ SWAGGER_ENABLED parsing: "1" and "true" are truthy
✔ cleanupOldScrollKeys removes oldest keys when limit exceeded
✔ cleanupOldScrollKeys does nothing when limit not exceeded
✔ cleanupOldScrollKeys handles exactly 50 keys
ℹ tests 58
ℹ suites 0
ℹ pass 58
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 69189.902916
```

**Expected**: All tests pass, including:

- api.subscriptions.gating.test.mjs (support inactive → 403, audit by trace_id, grant → 200, expire → 403, no-membership → EXPERT_MEMBERSHIP_REQUIRED)
- api.expert-rbac.tenancy.test.mjs (RBAC tests with subscription activated via grant-days in setup)

---

## 5. Stdout: pnpm audit:architecture

```
> tracked-lms@0.x.x audit:architecture <workspace>
> node tools/verify/architecture-freeze-audit.mjs

🏛️  Architecture Freeze Audit
...
✨ Architecture Freeze Audit: PASSED
```

_(Placeholder: run `pnpm audit:architecture`; paste actual output.)_

---

## 6. DB Proof (runbook 5.3)

### audit_log by trace_id (subscription deny)

```sql
SELECT created_at, action, trace_id, meta
FROM audit_log
WHERE trace_id = '<trace-id>'
ORDER BY created_at DESC;
```

(Только записи с валидным trace_id из x-request-id. Replace `<trace-id>` with value from smoke.)

| created_at | action                                           | trace_id  | meta (excerpt)                                         |
| ---------- | ------------------------------------------------ | --------- | ------------------------------------------------------ |
| ...        | subscription.denied.expert_subscription_inactive | trace-... | expertId, plan, status, currentPeriodEnd, path, method |

---

## 7. Что делать дальше по 5.3 (чётко)

1. **Освободить порт 3001** — команды в п.2 выше.
2. **Прогнать** `pnpm test:foundation` **с DB** (п.3) и **зафиксировать stdout в этот файл** (п.4).
3. **Убедиться, что в PR нет мусора**: dist/**, .env\*, debug/**, абсолютных путей.
4. **Открыть PR** → дождаться зелёного CI → merge.

---

## 8. Scope

- **Touched**: packages/shared (error code), apps/api (guard, expert controller, subscriptions module), tools/tests/foundation (api.subscriptions.gating.test.mjs, api.expert-rbac.tenancy.test.mjs), docs/runbooks, PR_ARTIFACTS_STORY_5.3.md
- **Not touched**: apps/webapp (gating only; “Стать экспертом” button in separate story)
