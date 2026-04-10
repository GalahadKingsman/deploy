# PR 5.1 — Артефакты для merge (Story 5.1: Subscription model free stub + default row on expert create)

Артефакты: без паролей, без абсолютных путей; env и пути — плейсхолдеры (например `<your DATABASE_URL>`, `<repo>`).

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
DATABASE_URL="<your DATABASE_URL>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation
```

В CI `DATABASE_URL` и `JWT_ACCESS_SECRET` заданы в workflow — suite не скипается.

**Expected**: Все тесты проходят, в том числе:

- `applied_migrations has 006_* after API start`
- `admin creates expert → expert_subscriptions row exists with defaults`

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

## 4. DB proof (runbook)

### applied_migrations

```sql
SELECT name FROM applied_migrations ORDER BY applied_at DESC LIMIT 10;
```

| name                         |
| ---------------------------- |
| 006_add_expert_subscriptions |
| ...                          |

### expert_subscriptions

```sql
SELECT expert_id, plan, status, price_cents, current_period_start, current_period_end
FROM expert_subscriptions
ORDER BY created_at DESC
LIMIT 5;
```

| expert_id | plan      | status   | price_cents | current_period_start | current_period_end |
| --------- | --------- | -------- | ----------- | -------------------- | ------------------ |
| ...       | free_stub | inactive | 0           | NULL                 | NULL               |

---

## 5. Scope checklist

- [ ] infra/migrations/006_add_expert_subscriptions.sql добавлена
- [ ] apps/api/src/database/migrations.ts — 006 в MIGRATION_LIST после 005
- [ ] packages/shared/src/contracts/v1/subscription.ts + index/schemas
- [ ] apps/api/src/subscriptions/ (repository + module)
- [ ] POST /admin/experts → ensureDefault(expert.id) после создания эксперта
- [ ] tools/tests/foundation/api.subscriptions.model.test.mjs
- [ ] docs/runbooks/STORY-5.1-FINAL-TEST-REPORT.md
- [ ] Нет изменений в apps/webapp/\*\*
- [ ] Нет gating/403 по подписке (Story 5.3)
- [ ] Нет admin grant/expire endpoints (Story 5.2)
