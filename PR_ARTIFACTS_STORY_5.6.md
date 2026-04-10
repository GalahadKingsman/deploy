# PR 5.6 — Expert Applications (submit + status) — Артефакты для merge

## 1. Stdout: pnpm verify

```
> tracked-lms@0.5.4 verify /<repo>
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
✅ Lint passed (28 warnings, 0 errors)

📝 Running typecheck...
✅ Typecheck passed (4 packages)

🏗️  Running build...
✅ Build passed (4 packages)

✨ All quality gates passed!
```

---

## 2. Stdout: pnpm test:foundation (с DB)

```bash
DATABASE_URL="<your DATABASE_URL>" \
JWT_ACCESS_SECRET="<test secret (>=16 chars)>" \
pnpm test:foundation
```

Expert application suite (api.me.expert-application.test.mjs) — 4 tests PASS. Full run includes other suites.

```
[API stderr] [migrations] MIGRATIONS_DIR=<repo>/infra/migrations
✔ no application → GET /me/expert-application = 200 { application: null } (441.994208ms)
✔ submit → POST → pending; then GET → pending (19.021416ms)
✔ resubmit from rejected: DB status=rejected, POST → pending, decided_* cleared (11.407125ms)
✔ audit by trace_id: after POST find expert.application.submitted (13.354791ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4400.733583
```

---

## 3. Stdout: pnpm audit:architecture

```
> tracked-lms@0.5.4 audit:architecture /<repo>
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

## 4. Screenshots (optional)

- [ ] /creator/onboarding — нет заявки (CTA «Подать заявку»)
- [ ] /creator/onboarding — заявка на рассмотрении (pending)
- [ ] /creator/onboarding — отклонено + CTA «Подать снова» (rejected)

---

## 5. Checklist

- [ ] Нет секретов, абсолютных путей, dist/\*_, .env_ в коммитах
- [ ] applied_migrations содержит 007_add_expert_applications
- [ ] Audit expert.application.submitted / resubmitted с trace_id
