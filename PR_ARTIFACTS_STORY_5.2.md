# PR 5.2 — Артефакты для merge (Story 5.2: Admin grant/expire expert subscription)

Артефакты: без паролей, без абсолютных путей; env и пути — только плейсхолдеры (нет `/Users/...`, нет реальных DATABASE_URL/host, нет `.env*`, `dist/**`, `debug/**`).

**PR description (вставить в описание PR):**

```
Artifacts: PR_ARTIFACTS_STORY_5.2.md

Runbook: docs/runbooks/STORY-5.2-FINAL-TEST-REPORT.md

CI must-have: pnpm verify / pnpm test:foundation / pnpm audit:architecture — PASS
```

## 1. Stdout: pnpm verify

```
> tracked-lms@... verify
> node tools/verify/verify.mjs

🚀 Quality Gates Verification
...
✅ Workspace list passed
✅ No deep imports found
✅ No wildcard paths found
...
✅ Lint passed
✅ Typecheck passed
✅ Build passed
✨ All quality gates passed!
```

_(Плейсхолдер; фактический stdout — после запуска `pnpm verify` без секретов/абсолютных путей в артефакте.)_

---

## 2. Stdout: pnpm test:foundation (с DB)

```bash
pnpm verify

DATABASE_URL="<your DATABASE_URL>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation

pnpm audit:architecture
```

В CI `DATABASE_URL` и `JWT_ACCESS_SECRET` заданы в workflow — suite не скипается.

**Expected**: Все тесты проходят, в том числе api.subscriptions.admin:

- admin → grant-days → 403 FORBIDDEN_PLATFORM_ROLE
- owner → grant-days days=30 → 200, ExpertSubscriptionV1, DB status=active
- owner → grant-days twice → End2 > End1
- owner → expire → 200, DB status=expired
- days=0 → 400 VALIDATION_ERROR
- expert not found → 404 EXPERT_NOT_FOUND
- audit grant_days / expire с trace_id = x-request-id

_(Placeholder: без секретов и абсолютных путей; фактический stdout — после запуска с DB.)_

---

## 3. Stdout: pnpm audit:architecture

```
> tracked-lms@... audit:architecture
> node tools/verify/architecture-freeze-audit.mjs

🏛️  Architecture Freeze Audit
...
✨ Architecture Freeze Audit: PASSED
```

_(Плейсхолдер; без секретов и абсолютных путей.)_

---

## 4. SQL proof (плейсхолдеры: &lt;expertId&gt;, &lt;trace-id&gt;)

### expert_subscriptions

```sql
SELECT * FROM expert_subscriptions WHERE expert_id = '<expertId>';
```

### audit_log by trace_id

```sql
SELECT created_at, action, trace_id, meta
FROM audit_log
WHERE trace_id = '<trace-id>'
ORDER BY created_at DESC;
```

---

## 5. Scope checklist

- [ ] apps/api: repository grantDays/expireNow, admin.subscriptions.controller, admin.module
- [ ] tools/tests/foundation/api.subscriptions.admin.test.mjs
- [ ] docs/runbooks/STORY-5.2-FINAL-TEST-REPORT.md
- [ ] Нет изменений в apps/webapp/\*\*
- [ ] Нет .env\*, нет dist/\*\*
