# PR 4.2 — Артефакты для merge

## 1. Stdout: pnpm verify

```
> tracked-lms@0.3.5 verify
> node tools/verify/verify.mjs

🚀 Quality Gates Verification

📦 Checking workspace...
✅ Workspace list passed (found 4 packages)

🔍 Checking for deep imports...
✅ No deep imports found

🚫 Checking for wildcard paths in tsconfig...
✅ No wildcard paths found

🚫 Checking for duplicate error codes in apps...
✅ No duplicate error codes found

🚫 Checking for manual error format in API controllers...
✅ No manual error format found

🔧 Checking shared package configuration...
  ✅ strict: true
  ✅ target: es2022
  ✅ module: commonjs
  ✅ moduleResolution: node10
✅ Shared config check passed

🔧 Running lint...
✅ Lint passed (27 warnings, 0 errors)

📝 Running typecheck...
✅ Typecheck passed (4 packages)

🏗️  Running build...
✅ Build passed (4 packages)

✨ All quality gates passed!
```

---

## 2. Stdout: pnpm test:foundation (с DB)

**Note**: All foundation suites use the shared `_utils` api-process; `waitForPortFree` hard-fails if port 3001 is not free, so tests never run against a stale API.

```bash
pnpm infra:up
# If Postgres is on 5433: DATABASE_URL="postgresql://user:***@localhost:5433/dbname"
DATABASE_URL="<your DATABASE_URL>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation
```

```
✔ GET /nope returns 404 with unified error format
✔ GET /health/400 returns 400 with validation error format
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
✔ user → POST /admin/experts returns 403 FORBIDDEN_PLATFORM_ROLE + audit deny by trace_id
✔ admin → POST /admin/experts returns 201 + expert and owner member created in DB
✔ admin → POST /admin/experts/:id/members add member → 201 + audit admin.expert.member.add
✔ admin → repeat add same member → 409 EXPERT_MEMBER_ALREADY_EXISTS
✔ admin → add member to non-existent expert → 404 EXPERT_NOT_FOUND
✔ admin → PATCH member role → 200 + audit admin.expert.member.role.set
✔ admin → PATCH member when not exists → 404 EXPERT_MEMBER_NOT_FOUND
✔ admin → DELETE member → 200 + audit admin.expert.member.remove
✔ admin → DELETE member when not exists → 404 EXPERT_MEMBER_NOT_FOUND
✔ admin → add member with invalid role → 400 INVALID_EXPERT_MEMBER_ROLE
✔ GET /docs returns 200 in development mode
✔ GET /docs returns 404 with error format in production mode
✔ SWAGGER_ENABLED parsing: "0" and "false" are falsy
✔ SWAGGER_ENABLED parsing: "1" and "true" are truthy
✔ cleanupOldScrollKeys removes oldest keys when limit exceeded
✔ cleanupOldScrollKeys does nothing when limit not exceeded
✔ cleanupOldScrollKeys handles exactly 50 keys

ℹ tests 29
ℹ pass 29
ℹ fail 0
```

---

## 3. Stdout: pnpm audit:architecture

```
> tracked-lms@0.3.5 audit:architecture
> node tools/verify/architecture-freeze-audit.mjs

🏛️  Architecture Freeze Audit

📦 A) Premature Abstractions Check
✅ No domain/ layer in webapp: OK
✅ No repositories/ layer in webapp: OK
✅ No services/ layer in webapp: OK
✅ No universal abstractions: OK

🔍 B) Duplication Check
✅ No duplicate error codes: OK
✅ No deep imports from @tracked/shared/src: OK
✅ No wildcard paths in tsconfig: OK

🔧 C) API Layer Check
✅ No manual error format in controllers: OK

✨ Architecture Freeze Audit: PASSED
```

---

## 4. DB Proof (runbook 4.2)

### applied_migrations

Stderr/логи должны содержать `[migrations] MIGRATIONS_DIR=...` — это подтверждает, что API применил миграции при старте.

```sql
SELECT name, applied_at
FROM applied_migrations
ORDER BY applied_at DESC
LIMIT 10;
```

| name                                          | applied_at |
| --------------------------------------------- | ---------- |
| 004_add_experts_and_members                   | ...        |
| 003_add_applied_migrations_and_platform_roles | ...        |
| 002_add_users_ban_and_audit_log               | ...        |
| 001_create_users_table                        | ...        |

### experts

```sql
SELECT id, title, slug, created_by_user_id FROM experts ORDER BY created_at DESC LIMIT 5;
```

| id  | title | slug | created_by_user_id |
| --- | ----- | ---- | ------------------ |
| ... | ...   | ...  | ...                |

### expert_members

```sql
SELECT expert_id, user_id, role FROM expert_members ORDER BY created_at DESC LIMIT 10;
```

| expert_id | user_id | role |
| --------- | ------- | ---- |
| ...       | ...     | ...  |

### audit_log (expert actions)

```sql
SELECT created_at, action, trace_id, meta
FROM audit_log
WHERE action IN ('admin.expert.create', 'admin.expert.member.add', 'admin.expert.member.role.set', 'admin.expert.member.remove')
ORDER BY created_at DESC
LIMIT 10;
```

| created_at | action | trace_id | meta |
| ---------- | ------ | -------- | ---- |
| ...        | ...    | ...      | ...  |

---

## 5. Error codes verified

| Scenario                          | Status | Code                         |
| --------------------------------- | ------ | ---------------------------- |
| add member when exists            | 409    | EXPERT_MEMBER_ALREADY_EXISTS |
| add member to non-existent expert | 404    | EXPERT_NOT_FOUND             |
| PATCH member when not exists      | 404    | EXPERT_MEMBER_NOT_FOUND      |
| DELETE member when not exists     | 404    | EXPERT_MEMBER_NOT_FOUND      |
| invalid role                      | 400    | INVALID_EXPERT_MEMBER_ROLE   |
| user → admin endpoint             | 403    | FORBIDDEN_PLATFORM_ROLE      |

---

## 6. Indexes (expert_members)

- UNIQUE(expert_id, user_id)
- INDEX(expert_id)
- INDEX(user_id)
- INDEX(expert_id, role) — для listMembers by role, "в каких экспертах user"
