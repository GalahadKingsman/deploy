# Story 4.2 — Expert accounts + expert members

**Purpose**: Verify experts and expert_members entities, admin endpoints, audit trail, and applied_migrations 003/004.

## Root cause (test infra fix)

Previously, `test:foundation` could fail with 404 on `/admin/experts` and "relation experts does not exist" because:

- **API process leak between suites** — `api.errors` and `api.health` used their own `spawn('pnpm', ['start'])` and a separate `apiProcess`; `_utils.stopApi()` did not kill that process, so port 3001 stayed occupied.
- Tests for experts/RBAC then hit the old API (no DB, no migrations 004, no `/admin/experts` routes).

**Fix**: All foundation suites now use the shared `_utils` api-process; `waitForPortFree` throws (hard-fail) if the port is not free before spawn, so tests never run against a stale API.

## CI

The CI workflow (`.github/workflows/ci.yml`) includes:

- Postgres service (port 5432)
- `DATABASE_URL` and `JWT_ACCESS_SECRET` env
- `pnpm test:foundation` — RBAC and experts tests run (not skipped)
- `pnpm audit:architecture`

## Definition of Done

- [ ] Migration 004 applied and reflected in applied_migrations after API start
- [ ] Tables experts and expert_members exist, UNIQUE(expert_id, user_id) enforced
- [ ] Admin endpoints work: create expert, add/update/remove member
- [ ] Errors return unified format with correct ErrorCodes (EXPERT_NOT_FOUND, EXPERT_MEMBER_ALREADY_EXISTS, etc.)
- [ ] Audit written for: create expert, add/update/remove member, deny by platform role
- [ ] trace_id matches x-request-id in audit
- [ ] All gates PASS: `pnpm verify`, `pnpm test:foundation`, `pnpm audit:architecture`
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

**Expected**: All pass.

## B) applied_migrations proof (003 and 004)

Use the **same** `DATABASE_URL` for `psql` and for the API.

1. Start infra and API:
   ```bash
   pnpm infra:up
   DATABASE_URL="<your DATABASE_URL>" \
   JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
   pnpm --filter @tracked/api dev
   ```
2. Once API is up, run:
   ```sql
   SELECT name, applied_at FROM applied_migrations ORDER BY applied_at DESC LIMIT 10;
   ```

**Expected**: Rows for 001, 002, 003, 004.

## C) DB proof: experts and expert_members

```sql
SELECT * FROM experts ORDER BY created_at DESC LIMIT 5;
SELECT * FROM expert_members ORDER BY created_at DESC LIMIT 20;
```

**Expected**: Tables exist; expert_members has UNIQUE(expert_id, user_id).

## D) audit_log proof by trace_id

```sql
SELECT created_at, action, trace_id, meta FROM audit_log ORDER BY created_at DESC LIMIT 20;
```

**Expected**: Entries for `admin.expert.create`, `admin.expert.member.add`, `admin.expert.member.role.set`, `admin.expert.member.remove`, `rbac.denied.platform_role`; trace_id matches x-request-id header.

## E) Manual smoke (curl / psql)

### 1. Create admin user (psql)

```sql
UPDATE users SET platform_role = 'admin' WHERE id = '<your-user-id>';
```

### 2. Create expert (curl)

```bash
curl -X POST http://localhost:3001/admin/experts \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -H "x-request-id: trace-$(uuidgen)" \
  -d '{"title":"My Expert","ownerUserId":"<owner-user-uuid>"}'
```

**Expected**: 201 with `{ "id": "<uuid>" }`.

### 3. Add member

```bash
curl -X POST http://localhost:3001/admin/experts/<expert-id>/members \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<user-uuid>","role":"manager"}'
```

**Expected**: 201 with `{ "ok": true }`.

### 4. Update role

```bash
curl -X PATCH http://localhost:3001/admin/experts/<expert-id>/members/<user-id> \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"role":"reviewer"}'
```

**Expected**: 200 with `{ "ok": true }`.

### 5. Remove member

```bash
curl -X DELETE http://localhost:3001/admin/experts/<expert-id>/members/<user-id> \
  -H "Authorization: Bearer <JWT>"
```

**Expected**: 200 with `{ "ok": true }`.

## Admin endpoints summary

| Endpoint                                 | Method | Required role | Description                  |
| ---------------------------------------- | ------ | ------------- | ---------------------------- |
| /admin/experts                           | POST   | admin+        | Create expert + owner member |
| /admin/experts/:expertId/members         | POST   | admin+        | Add member (409 if exists)   |
| /admin/experts/:expertId/members/:userId | PATCH  | admin+        | Update member role           |
| /admin/experts/:expertId/members/:userId | DELETE | admin+        | Remove member                |

**Audit actions**:

- `admin.expert.create` — meta: title, slug, ownerUserId
- `admin.expert.member.add` — meta: expertId, userId, role
- `admin.expert.member.role.set` — meta: from, to
- `admin.expert.member.remove` — meta: expertId, userId, role
- `rbac.denied.platform_role` — when user lacks admin role
