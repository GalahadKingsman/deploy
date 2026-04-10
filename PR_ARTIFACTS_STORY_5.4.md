# PR 5.4 — Артефакты (Expert subscription CTA — student default + onboarding + dev override + ngrok fix)

## 1. Stdout: pnpm verify

```bash
pnpm verify
```

```
✅ Workspace list passed (found 4 packages)
✅ No deep imports found
✅ No wildcard paths found
✅ No duplicate error codes found
✅ No manual error format found
✅ Shared config check passed
✅ Lint passed
✅ Typecheck passed
✅ Build passed
✨ All quality gates passed!
```

(Exit code: 0)

---

## 2. Stdout: pnpm audit:architecture

```bash
pnpm audit:architecture
```

```
🏛️  Architecture Freeze Audit
✅ No domain/ layer in webapp: OK (0 matches)
✅ No repositories/ layer in webapp: OK (0 matches)
✅ No services/ layer in webapp: OK (0 matches)
✅ No universal abstractions: OK (0 matches)
✅ No duplicate error codes in apps: OK
✅ No deep imports from @tracked/shared/src: OK (0 matches)
✅ No wildcard paths in tsconfig: OK (0 matches)
✅ No manual error format in controllers: OK (0 matches)
✨ Architecture Freeze Audit: PASSED
```

(Exit code: 0)

---

## 3. Stdout: webapp tests

```bash
pnpm --filter @tracked/webapp test
```

```
 RUN  v2.1.9
 ✓ src/features/account/__tests__/expertCtaState.test.ts (5 tests) 1ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  205ms
```

(Exit code: 0. deriveExpertCtaState тесты PASS.)

---

## 4. Скриншоты (Mini App + браузер)

Без секретов, без абсолютных путей, без .env, без dist/\*\*.

### 4.1. Telegram Mini App — Account

Скрин из Mini App (Account): должно быть видно:

- **Ник + Pro справа** — displayName и бейдж Pro в одной строке (Pro справа; при длинном имени имя обрезается, Pro остаётся).
- **TG ID + copy icon** — строка с числом ID и иконкой копирования (icon-only, без текста «Copy»).
- **CTA-блок** — либо «Стать экспертом» (student), либо «Вы эксперт» / активная подписка — оба варианта ок.

![Mini App — Account](docs/assets/story-5.4/mini-account.png)

### 4.2. Браузер — Account и Onboarding

| Состояние  | URL                                  | Что проверить                                                    |
| ---------- | ------------------------------------ | ---------------------------------------------------------------- |
| NONE       | `/account?expertCta=none`            | **Нет Pro**; CTA «Стать экспертом»; в браузере строки TG ID нет. |
| EXPIRED    | `/account?expertCta=expired`         | Бейдж Pro есть; CTA в состоянии expired.                         |
| ACTIVE     | `/account?expertCta=active`          | Бейдж Pro есть; CTA «Вы эксперт» / активная подписка.            |
| Onboarding | `/creator/onboarding?expertCta=none` | Страница «Стать экспертом» (onboarding), без Pro.                |

![Account — none](docs/assets/story-5.4/browser-none.png)

![Account — expired](docs/assets/story-5.4/browser-expired.png)

![Account — active](docs/assets/story-5.4/browser-active.png)

![Onboarding — none](docs/assets/story-5.4/browser-onboarding-none.png)

**UX (5.4):** TG ID — только число + icon-only Copy (variant=ghost, aria-label="Copy ID"); только в Telegram. Бейдж «Pro» только при `state !== 'none'`; в одной строке с ником справа (fix 5.4).

---

## 5. Runbook

См. [docs/runbooks/STORY-5.4-FINAL-TEST-REPORT.md](docs/runbooks/STORY-5.4-FINAL-TEST-REPORT.md).

---

## 6. Scope

- **Touched**: apps/webapp (AccountPage, CreatorOnboardingPage, features/account, shared/queries, shared/api/errors, shared/mocks), docs/runbooks (telegram-dev, STORY-5.4-FINAL-TEST-REPORT), PR_ARTIFACTS_STORY_5.4.md
- **Not touched**: apps/api, packages/shared, .env (реальные значения), apps/webapp/dist/\*\*, debug overlay
