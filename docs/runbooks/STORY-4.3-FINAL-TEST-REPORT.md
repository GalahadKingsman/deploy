# Story 4.3 — Expert RBAC guards, tenancy, audit

**Purpose**: Verify expert-scoped endpoints are protected by membership + role, deny audit entries with trace_id, and tenancy standard for future expert modules.

## CI

The CI workflow (`.github/workflows/ci.yml`) includes:

- Postgres service (port 5432)
- `DATABASE_URL` and `JWT_ACCESS_SECRET` env
- `pnpm test:foundation` — expert RBAC tests run (not skipped)
- `pnpm audit:architecture`

## Definition of Done

- [ ] Expert RBAC guard works via expert_members (membership + role rank)
- [ ] Two expert endpoints: GET /experts/:expertId/ping (support+), GET /experts/:expertId/admin-ping (manager+)
- [ ] Deny writes audit with action rbac.denied.expert_membership / rbac.denied.expert_role, meta and trace_id
- [ ] Errors use unified format and shared codes (EXPERT_MEMBERSHIP_REQUIRED, FORBIDDEN_EXPERT_ROLE, EXPERT_CONTEXT_REQUIRED); missing expert context → **400** Bad Request
- [ ] All gates PASS: `pnpm verify`, `pnpm test:foundation`, `pnpm audit:architecture`
- [ ] Runbook 4.3 + PR artifacts filled (no secrets)

## A) Gates

```bash
pnpm verify
pnpm test:foundation
pnpm audit:architecture
```

**Expected**: All pass. Foundation tests require `DATABASE_URL` and `JWT_ACCESS_SECRET`; CI provides them.

## B) API proof: /experts/:expertId/ping 200 (for member)

1. Create expert via POST /admin/experts (admin JWT), get `expertId`.
2. Add a user as support via POST /admin/experts/:expertId/members (body: userId, role: support).
3. Call GET /experts/:expertId/ping with that user's JWT.

**Expected**: 200, body `{ ok: true, expertId }`.

## C) Negative proof: 403 membership required + audit row by trace_id

1. Use a user that is **not** a member of the expert.
2. Call GET /experts/:expertId/ping with that user's JWT and header `x-request-id: <trace_id>`.
3. **Expected**: 403, code `EXPERT_MEMBERSHIP_REQUIRED`, response `requestId` = `x-request-id`.
4. Query: `SELECT * FROM audit_log WHERE trace_id = '<trace_id>' AND action = 'rbac.denied.expert_membership'`.
5. **Expected**: One row; meta contains expertId, requiredRole, userRole, path, method.

## D) Negative proof: 403 forbidden role + audit row by trace_id

1. Use a user that is a **support** member of the expert.
2. Call GET /experts/:expertId/admin-ping with that user's JWT and header `x-request-id: <trace_id>`.
3. **Expected**: 403, code `FORBIDDEN_EXPERT_ROLE`.
4. Query: `SELECT * FROM audit_log WHERE trace_id = '<trace_id>' AND action = 'rbac.denied.expert_role'`.
5. **Expected**: One row; meta contains expertId, requiredRole, userRole, path, method.

## E) SQL proof: expert_members and audit_log

Use the **same** `DATABASE_URL` as the API/tests.

```sql
SELECT * FROM expert_members ORDER BY created_at DESC LIMIT 20;
SELECT created_at, action, trace_id, meta
FROM audit_log
WHERE action LIKE 'rbac.denied.expert_%'
ORDER BY created_at DESC
LIMIT 20;
```

**Expected**:

- `expert_members`: rows for experts created via admin; roles owner/manager/reviewer/support.
- `audit_log`: rows with action `rbac.denied.expert_membership` or `rbac.denied.expert_role`, trace_id and meta populated.

## Tenancy standard

New expert endpoints: path must include `:expertId`, use `JwtAuthGuard` + `ExpertRoleGuard`, and `@RequireExpertRole(...)`. See `docs/runbooks/expert-endpoints-tenancy.md`.
