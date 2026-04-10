# PR 4.3 — Артефакты для merge (Expert RBAC, tenancy, audit)

## 1. Stdout: pnpm verify

```
> tracked-lms@0.3.5 verify /Users/user/Project/edify_main
> node tools/verify/verify.mjs

🚀 Quality Gates Verification
...
✨ All quality gates passed!
```

_(Вставить актуальный вывод после запуска.)_

---

## 2. Stdout: pnpm test:foundation (с DB)

```bash
DATABASE_URL="<your DATABASE_URL>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation
```

**Ожидаемо**: все тесты проходят, в том числе:

- applied*migrations содержит 003*_ и 004\__
- user без membership → GET /experts/:expertId/ping = 403 EXPERT_MEMBERSHIP_REQUIRED + audit rbac.denied.expert_membership, trace_id
- support member → GET /experts/:expertId/ping = 200
- support member → GET /experts/:expertId/admin-ping = 403 FORBIDDEN_EXPERT_ROLE + audit rbac.denied.expert_role
- manager member → GET /experts/:expertId/admin-ping = 200
- audit deny meta: expertId, requiredRole, userRole, path, method
- trace_id в audit совпадает с x-request-id

_(Вставить актуальный stdout после запуска.)_

---

## 3. Stdout: pnpm audit:architecture

```
> tracked-lms@0.3.5 audit:architecture /Users/user/Project/edify_main
> node tools/verify/architecture-freeze-audit.mjs

🏛️  Architecture Freeze Audit
...
✨ Architecture Freeze Audit: PASSED
```

_(Вставить актуальный вывод после запуска.)_

---

## 4. SQL proof: deny entries by trace_id

После выполнения тестов (или ручных запросов с известным x-request-id):

```sql
SELECT created_at, action, trace_id, meta
FROM audit_log
WHERE action LIKE 'rbac.denied.expert_%'
ORDER BY created_at DESC
LIMIT 20;
```

| created_at | action                        | trace_id | meta                                                                                                         |
| ---------- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| ...        | rbac.denied.expert_membership | trace-…  | {"expertId":"…","requiredRole":"support","userRole":null,"path":"/experts/…/ping","method":"GET"}            |
| ...        | rbac.denied.expert_role       | trace-…  | {"expertId":"…","requiredRole":"manager","userRole":"support","path":"/experts/…/admin-ping","method":"GET"} |

---

## 5. Ручной тест

1. Поднять инфру: `pnpm infra:up`
2. Запустить тесты:  
   `DATABASE_URL="<your db url>" JWT_ACCESS_SECRET="0123456789abcdef" pnpm test:foundation`
3. SQL proof (expert_members и audit deny):

```sql
SELECT * FROM expert_members ORDER BY created_at DESC LIMIT 20;
SELECT created_at, action, trace_id, meta
FROM audit_log
WHERE action LIKE 'rbac.denied.expert_%'
ORDER BY created_at DESC
LIMIT 20;
```

---

Артефакты оформлены без секретов (токены/пароли не вставлять).
