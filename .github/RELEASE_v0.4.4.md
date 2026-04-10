# Release v0.4.4 — Story 4.4: admin audit read (filters + cursor pagination)

## Summary

- **Story 4.4**: Admin read API for audit log with filters and cursor-based pagination; RBAC admin-only; foundation tests and runbook.

## Changes (Story 4.4)

- **Shared**: `AuditLogEntryV1`, `AuditLogListResponseV1` contracts and Zod schemas; meta always present (nullable).
- **API**: GET /admin/audit (query: actorUserId, action, entityType, entityId, traceId, from, to, limit, cursor); GET /admin/audit/actions; AdminAuditController; AuditRepository list/listActions; cursor validation returns 400 VALIDATION_ERROR on invalid base64/JSON/date/UUID.
- **Migration 005**: Indexes for audit_log read (created_at DESC id DESC, trace_id, actor_user_id, entity_type+entity_id).
- **Foundation tests**: api.admin.audit-read.test.mjs (user → 403, admin → 200 + schema, filter traceId, cursor pagination no overlap, invalid cursor → 400, list actions).

## Verification (gates)

```bash
pnpm verify
pnpm test:foundation
pnpm audit:architecture
```

## Runbook and artifacts

- Runbook: [docs/runbooks/STORY-4.4-FINAL-TEST-REPORT.md](../docs/runbooks/STORY-4.4-FINAL-TEST-REPORT.md)
- PR artifacts: [PR_ARTIFACTS_STORY_4.4.md](../PR_ARTIFACTS_STORY_4.4.md)
