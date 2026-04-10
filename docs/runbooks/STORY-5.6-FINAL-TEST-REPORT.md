# Story 5.6 — Expert Applications (submit + status)

**Purpose**: Студент может подать заявку стать экспертом в WebApp. Заявка хранится в БД, читается через API, отображается на /creator/onboarding. Submit + status без апрувов/активаций (5.7).

**Scope**: infra/migrations, apps/api (expert-applications, me), packages/shared contracts, apps/webapp (CreatorOnboardingPage, useMyExpertApplication), MSW, tools/tests/foundation.

## Definition of Done

- [ ] GET/POST /me/expert-application работает, idempotent
- [ ] DB migration 007 подключена и видна в applied_migrations
- [ ] Audit пишется с trace_id (expert.application.submitted / resubmitted)
- [ ] WebApp /creator/onboarding показывает состояние заявки и даёт «Подать заявку»
- [ ] MSW: override только при expertApp, иначе passthrough
- [ ] pnpm verify, pnpm test:foundation (с DB), pnpm audit:architecture — PASS
- [ ] В PR нет мусора: .env\*, dist/**, debug/**, абсолютных путей

## Gates

```bash
pnpm verify
```

```bash
DATABASE_URL="<your DATABASE_URL>" JWT_ACCESS_SECRET="<test secret (>=16 chars)>" pnpm test:foundation
```

```bash
pnpm audit:architecture
```

## Manual smoke

1. Открыть /creator/onboarding (WebApp или Mini App).
2. Подать заявку → кнопка «Подать заявку» → после успеха «Заявка на рассмотрении».
3. DEV: проверить состояния через ?expertApp=none|pending|rejected|approved.

## SQL proof

```sql
SELECT * FROM expert_applications WHERE user_id = '<userId>';
```

```sql
SELECT created_at, action, trace_id, meta FROM audit_log WHERE trace_id = '<trace-id>';
```

(После POST /me/expert-application с заголовком x-request-id в audit_log должна быть запись с action = expert.application.submitted или expert.application.resubmitted.)

## Dev override (?expertApp=)

| Состояние       | URL                                    |
| --------------- | -------------------------------------- |
| Нет заявки      | /creator/onboarding?expertApp=none     |
| На рассмотрении | /creator/onboarding?expertApp=pending  |
| Отклонено       | /creator/onboarding?expertApp=rejected |
| Одобрено        | /creator/onboarding?expertApp=approved |

## Файлы

| Item         | Location                                                                         |
| ------------ | -------------------------------------------------------------------------------- |
| Migration    | infra/migrations/007_add_expert_applications.sql                                 |
| Contracts    | packages/shared/src/contracts/v1/expert-application.ts, me-expert-application.ts |
| Repository   | apps/api/src/expert-applications/expert-applications.repository.ts               |
| Me endpoints | apps/api/src/modules/me/me-expert-application.controller.ts                      |
| Hook         | apps/webapp/src/shared/queries/useMyExpertApplication.ts                         |
| Page         | apps/webapp/src/pages/CreatorOnboardingPage.tsx                                  |
| MSW          | apps/webapp/src/shared/mocks/handlers.ts, inline.ts, fixtures.ts                 |
| Foundation   | tools/tests/foundation/api.me.expert-application.test.mjs                        |
