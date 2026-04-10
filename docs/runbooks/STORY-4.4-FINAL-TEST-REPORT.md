# Story 4.4 — Admin audit read (filters + cursor pagination)

**Purpose**: Verify GET /admin/audit and GET /admin/audit/actions (admin-only), filters, cursor pagination, and foundation tests.

## CI

The CI workflow (`.github/workflows/ci.yml`) includes:

- Postgres service (port 5432)
- `DATABASE_URL` and `JWT_ACCESS_SECRET` env
- `pnpm test:foundation` — audit-read tests run (not skipped)
- `pnpm audit:architecture`

## Definition of Done

- [ ] GET /admin/audit exists, RBAC admin+ only
- [ ] Query params: actorUserId, action, entityType, entityId, traceId, from, to, limit (default 50, max 200), cursor
- [ ] Response: AuditLogListResponseV1 (items, nextCursor?), sort created_at DESC, id DESC
- [ ] GET /admin/audit/actions returns distinct actions (admin only)
- [ ] Foundation tests: user → 403, admin → 200 + schema, filter traceId, cursor no overlap, actions list
- [ ] All gates PASS: `pnpm verify`, `pnpm test:foundation`, `pnpm audit:architecture`
- [ ] Runbook + PR artifacts (no secrets)

## 1. Gates

```bash
pnpm verify
pnpm test:foundation
pnpm audit:architecture
```

**Expected**: All pass. Foundation tests require `DATABASE_URL` and `JWT_ACCESS_SECRET`; CI provides them.

## 2. curl examples

Use the same `DATABASE_URL` and JWT for admin (create admin user or use existing).

**User → 403**

```bash
# Token for user with platform_role=user
curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <user_jwt>" "http://localhost:3001/admin/audit?limit=10"
# Expected: 403
```

**Admin → list**

```bash
curl -sS -H "Authorization: Bearer <admin_jwt>" "http://localhost:3001/admin/audit?limit=10"
# Expected: 200, { "items": [...], "nextCursor": "..." (if more) }
```

**Admin → filter by traceId**

```bash
curl -sS -H "Authorization: Bearer <admin_jwt>" "http://localhost:3001/admin/audit?traceId=<trace_id>&limit=50"
# Expected: 200, items containing entry with that traceId
```

**Admin → cursor pagination**

```bash
# Page 1
curl -sS -H "Authorization: Bearer <admin_jwt>" "http://localhost:3001/admin/audit?limit=2"
# Copy nextCursor from response, then:
# Page 2
curl -sS -H "Authorization: Bearer <admin_jwt>" "http://localhost:3001/admin/audit?limit=2&cursor=<nextCursor>"
# Expected: 200, items do not overlap with page 1 (by id)
```

**Admin → list actions**

```bash
curl -sS -H "Authorization: Bearer <admin_jwt>" "http://localhost:3001/admin/audit/actions"
# Expected: 200, { "items": ["rbac.denied.platform_role", "admin.user.platform_role.set", ...] }
```

## 3. SQL proof

Use the **same** `DATABASE_URL` as the API/tests. No secrets in runbook.

**Last 10 audit_log**

```sql
SELECT id, created_at, action, trace_id, actor_user_id, entity_type, entity_id
FROM audit_log
ORDER BY created_at DESC, id DESC
LIMIT 10;
```

**By trace_id (parameterized; replace placeholder)**

```sql
SELECT id, created_at, action, trace_id, meta
FROM audit_log
WHERE trace_id = $1
ORDER BY created_at DESC
LIMIT 50;
-- Run with: trace_id = '<your_trace_id>'
```

**Expected**: Rows match what GET /admin/audit returns for same filters; trace_id filter returns only that row.

## 4. Cursor pagination proof

1. GET /admin/audit?limit=2 (admin JWT) → note `items[].id` and `nextCursor`.
2. GET /admin/audit?limit=2&cursor=<nextCursor> (admin JWT) → note `items[].id`.
3. **Expected**: No id from step 2 appears in step 1 (no overlap).

## 5. Manual checks

- User token → GET /admin/audit → 403, code FORBIDDEN_PLATFORM_ROLE
- Admin token → GET /admin/audit?limit=1 → 200, body has `items` (array), optional `nextCursor`
- Admin token → GET /admin/audit/actions → 200, body has `items` (array of strings)
