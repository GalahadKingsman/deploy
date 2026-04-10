# Changelog

All notable changes to this project will be documented in this file.

## [0.4.4] - 2026-01-31 - Story 4.4: admin audit read (filters + cursor pagination)

### Added

- **Story 4.4 — Admin audit read** — GET /admin/audit and GET /admin/audit/actions (admin-only), filters, cursor pagination, indexes, foundation tests
  - Shared: `AuditLogEntryV1`, `AuditLogListResponseV1` contracts and schemas; meta always present (nullable)
  - API: AdminAuditController (GET /admin/audit with actorUserId, action, entityType, entityId, traceId, from, to, limit, cursor; GET /admin/audit/actions); AuditRepository list/listActions; cursor validation (400 VALIDATION_ERROR on invalid base64/JSON/date/UUID)
  - Migration 005: indexes for audit_log read (created_at DESC id DESC, trace_id, actor_user_id, entity_type+entity_id)
  - Foundation tests: api.admin.audit-read.test.mjs (user 403, admin 200 + schema, filter traceId, cursor no overlap, invalid cursor 400, list actions)
- **Runbook** — `docs/runbooks/STORY-4.4-FINAL-TEST-REPORT.md`; **Artifacts** — `PR_ARTIFACTS_STORY_4.4.md`

### Fixed

- Audit list LIMIT param index when no filters (was causing 500)

## [0.3.5] - 2026-01-30 - Mini App env check runbook, PR checklist

### Added

- **Runbook** — `docs/runbooks/mini-app-env-triage.md`: один короткий прогон (printenv, телеметрия [load-env], Mini App ?debug=1), кейсы A–E, чеклист для отчёта
- **PR** — `.github/MINI_APP_ENV_CHECK_PR.md`: шаблон для вставки в PR-комментарий (результат прогона env + Mini App)

### Changed

- Runbook: ожидание printenv «0 и 0»; проверка URL запросов; быстрый фикс кейса C (очистка storage + переоткрытие Mini App); требование стабильных len/sha между перезапусками

## [0.3.4.5] - 2026-01-30 - Ban enforcement (Story 3.5), stable dev startup

### Added

- **Story 3.5 — Ban enforcement** — Banned users get 403 (USER_BANNED) on POST /auth/telegram and GET /me; minimal audit entry per denied request
  - Shared: error code `USER_BANNED` exported from `@tracked/shared`
  - DB: `users.banned_at`, `users.ban_reason`; table `audit_log` (actor_user_id, action, entity_type, entity_id, meta, trace_id, created_at)
  - API: TelegramAuthService checks banned after upsert → 403 + audit `auth.blocked.banned`; JWT guard loads user → if banned 403 + audit `request.blocked.banned`
  - ApiExceptionFilter: custom `code` from exception (e.g. USER_BANNED) for 403
- **Dev startup** — Single-scheme launch: `pnpm dev:app` (API + Webapp) or `pnpm dev` (all)
  - `tools/dev/ensure-env.mjs`: create `.env` from `.env.example` if missing; set `JWT_ACCESS_SECRET` (32 chars) if empty
  - Turbo `dev` task: `dependsOn: ["^build"]` so shared builds before apps
  - `pnpm dev:app`: ensure-env + turbo dev only for @tracked/api and @tracked/webapp
- **API** — `TELEGRAM_BOT_TOKEN` optional (default ''); POST /auth/telegram returns 503 "Telegram auth not configured" if empty so API starts without it

### Changed

- **README** — Quick Start: "Запуск проекта (одна схема)" with `pnpm dev:app`; no manual `.env` copy
- **API** — JWT: load `jsonwebtoken` via `createRequire(import.meta.url)` so `jwt.sign`/`jwt.verify` work in ESM (fixes "jwt.sign is not a function")

### Fixed

- JWT in ESM: `jwt.sign is not a function` — use `require('jsonwebtoken')` via createRequire so Mini App auth and /me return real user data

## [0.3.4] - 2026-01-29 - Bot WebApp button, ngrok dev fixes (Story 3.4)

### Added

- **Bot (Story 3.4)** — `/start` returns inline button "Open WebApp" opening Mini App via `TELEGRAM_WEBAPP_URL`
  - Startup validation: `TELEGRAM_WEBAPP_URL` required, must be https, trailing slash stripped
  - Bot reads env from root `.env` (`--env-file-if-exists=../../.env`), entrypoint `dist/apps/bot/src/index.js`
  - `apps/bot/.env.example`: `BOT_TOKEN`, `TELEGRAM_WEBAPP_URL`
- **Runbooks** — Free ngrok workflow (Story 3.4), infra baseline (v0.3.3+), allowedHosts troubleshooting

### Changed

- **WebApp** — Vite dev: `server.allowedHosts` for `.ngrok-free.dev`, `.ngrok-free.app`, `.ngrok-free.de` (no "Blocked request" via ngrok)
- **Protocol** — `run-with-protocol.mjs`: `--timeout-ms=*` and leading `--` no longer passed to command (long-running dev works)
- **Local infra** — All `docker compose` examples use `--env-file .env`; Infra baseline section in runbook

### Fixed

- Bot entrypoint: start script uses `dist/apps/bot/src/index.js` (correct build output)
- ngrok ERR_NGROK_8012: run ngrok with `127.0.0.1:5173` instead of `localhost:5173` (IPv4 vs ::1)

## [0.3.4.1] - 2026-01-29 - Mobile tab bar layout (Telegram Mini App)

### Fixed

- **WebApp (mobile)** — Bottom tab bar no longer overlapped by main content: increased main `paddingBottom` to 80px + safe-area
- **WebApp (mobile)** — Tab bar: `minHeight` instead of fixed height, `flex: 1` + centered icon/label per tab, proper centering in Telegram

## [0.3.4.4] - 2026-01-30 - Story 3.4 test:foundation 100% green (Swagger /docs)

### Fixed

- **Foundation tests** — `GET /docs returns 200 in development mode` and `SWAGGER_ENABLED parsing: "1" and "true"` now pass
  - Test helper: when `swaggerEnabled: true`, force `NODE_ENV=development`; strip `NODE_ENV`/`SWAGGER_ENABLED` from parent env so test env is used
  - API `load-env`: preserve `NODE_ENV` and `SWAGGER_ENABLED` when already set (e.g. by tests or process manager) so `.env` does not override
- Swagger test: request `/docs` with `redirect: 'manual'` so response is for `/docs` itself

### Added

- **Runbooks** — `STORY-3.4-FINAL-TEST-REPORT.md` (final test report and artifacts for Story 3.4)

## [0.3.4.3] - 2026-01-30 - Real profile from Telegram, instant load, profile cache (EPIC 3.3.6)

### Added

- **WebApp — Real user data** — Learn and Account pages use `useMe()` (GET /me); name, username, avatar from Telegram replace mock data
- **Telegram Web App SDK** — `index.html` loads `telegram-web-app.js` so `window.Telegram.WebApp` and `initData` are available in Mini App
- **Bootstrap loading screen** — First paint shows app-style gradient + spinner instead of black screen while auth/bootstrap runs
- **QueryClientProvider** — React Query wrapped in App so `useMe()` works on Learn/Account
- **Profile/avatar cache** — `useMe`: 10 min staleTime, no refetch on mount, keepPreviousData; avatar URLs cached so no placeholder flash when returning to Profile
- **API** — Exception filter logs full error + stack on 500; `load-env` and dotenv so API reads root `.env`; JWT fix: `import jwt from 'jsonwebtoken'` for ESM
- **Auth diagnostic** — Optional AuthDiagnosticContext (dev); flat API error format parsed so real message shown (e.g. Invalid signature)

### Changed

- **WebApp** — TopBar shows "Edify" again; diagnostic banner removed from AppShell
- **WebApp** — fetchJson accepts API flat error shape `{ statusCode, code, message, requestId }` and shows real message
- **WebApp** — Bootstrap runs after first paint; app renders loading screen then replaces with App when bootstrap completes
- **API** — DatabaseModule reads `DATABASE_URL` at factory call time after env load

### Fixed

- JWT: `jwt.sign is not a function` — use default import for jsonwebtoken in ESM
- Profile: no loading flash when navigating Learn → Profile — useMe cache + avatar URL cache
- Black screen on Mini App open — loading screen with app background shown immediately

## [0.3.4.2] - 2026-01-29 - Tab bar safe-area, single source of truth (--tabs-h, --topbar-h)

### Changed

- **Layout tokens** — `--topbar-h: 56px` and `--tabs-h: 72px` in tokens.css; AppShell main uses them for paddingTop/paddingBottom
- **BottomTabs** — Total height = `--tabs-h` + `--safe-bottom`; `paddingBottom: var(--safe-bottom)` so content area is never squeezed on iOS; ellipsis for long labels
- **TopBar** — `minHeight: calc(var(--topbar-h) + var(--safe-top))`, `paddingTop: var(--safe-top)`; Toast/ToastHost use `var(--topbar-h)` for top offset

### Fixed

- Tab bar on iPhone: no icon/label clipping; panel does not sit on home indicator; no double safe-area gap
- Single source of truth for bar heights so main padding always matches actual chrome height

## [0.2.2] - 2026-01-25 - WebApp UI Foundation (EPIC 1)

### Added

#### WebApp UI Kit (Story 1.3)

- **UI Components**
  - Button component with variants (primary, secondary, ghost, danger) and sizes
  - Card component with CardHeader, CardTitle, CardDescription, CardContent
  - Input component with label, hint, and error states
  - ListItem component for navigation and actions
  - Skeleton component for loading states
  - EmptyState and ErrorState components for feedback
  - Toast notification system with useToast hook
  - Modal component for dialogs

#### WebApp Pages & Features

- **Learn Page (Story 1.4)**
  - Current course card with progress circle
  - Next lesson card
  - Continue learning section with progress bars
  - My courses horizontal scroll section
  - News section
  - Loading/empty/error states via query params

- **Library Page (Story 1.5)**
  - Catalog courses section (vertical list)
  - Recommendations section (horizontal scroll)
  - News section
  - Local search functionality with filtering
  - Mock data for courses and news
  - Loading/empty/error states via query params

- **Account Page (Story 1.6)**
  - Profile card with avatar, name, handle, status badge
  - Referral card with code, link, and copy to clipboard
  - Stats row with progress, streak, and points metrics
  - Actions list with navigation
  - Copy to clipboard with fallback support
  - Loading/empty/error states via query params

- **Stub Screens (Story 1.7)**
  - CourseDetailPage, LessonPage, UpdatePage
  - SettingsPage, CreatorOnboardingPage
  - NotFoundPage for 404 fallback
  - Unified stub page UI pattern
  - All routes properly configured

#### UI Improvements

- **Toast Component**
  - Fixed positioning and animation (centered, no left shift)
  - Proper willChange optimization
  - Responsive width calculation

- **Navigation**
  - Removed headers from Library and Account pages
  - All actions navigate to proper routes instead of toast
  - News items in Library are clickable

### Technical Details

- All components use design tokens (--sp-_, --text-_, --fg, --muted-fg, etc.)
- No inline "magic" colors
- Scroll restoration preserved
- All routes work without 404 errors
- Consistent UI patterns across all pages

## [0.1.0] - 2024 - Foundation (EPIC 0)

### Added

#### Infrastructure & Tooling

- **Monorepo Setup**
  - pnpm workspace configuration
  - Turborepo for build caching and parallel execution
  - TypeScript base configuration
  - Package structure: `apps/api`, `apps/webapp`, `apps/bot`, `packages/shared`

- **Code Quality**
  - ESLint with flat config (TypeScript + React rules)
  - Prettier for code formatting
  - Husky pre-commit hooks with lint-staged
  - GitHub Actions CI workflow
  - Quality Gates verification system (`pnpm verify`)

- **Environment Management**
  - Zod schemas for runtime env validation
  - Unified env schemas for all applications
  - Secret masking in validation errors

- **Local Infrastructure**
  - Docker Compose setup (PostgreSQL, Redis, MinIO)
  - Healthchecks for all services
  - Infrastructure runbooks

#### Applications

- **API** (`apps/api`)
  - NestJS + Fastify setup
  - `/health` endpoint
  - Unified error response format
  - Request ID tracing (`x-request-id` header)
  - Pino structured logging
  - Swagger UI at `/docs` (development only)

- **WebApp** (`apps/webapp`)
  - React + Vite setup
  - React Router with 3-tab navigation (Library, Learn, Account)
  - Bottom navigation bar
  - Safe-area handling for mobile viewports

- **Bot** (`apps/bot`)
  - grammY framework setup
  - `/start` command handler
  - Error handling without token leakage

#### Shared Package

- Environment validation schemas (API, Bot, Webapp)
- Error codes and types
- Contracts (pagination types)
- Public API exports (no deep imports allowed)

#### Documentation

- Repository workflow runbook
- Quality gates documentation
- Local infrastructure runbook
- Telegram Mini App development runbook
- PR template
- Cursor AI rules

#### Development Tools

- ngrok helper scripts and documentation
- Quality gates verification script
- Development helper commands

### Technical Details

- **Node.js**: 20+
- **Package Manager**: pnpm 9.0.0
- **Build System**: Turborepo 2.x
- **TypeScript**: 5.5+
- **Backend Framework**: NestJS 10.x, Fastify 5.x
- **Frontend**: React 18.x, Vite 5.x
- **Bot Framework**: grammY 1.x
- **Validation**: Zod 3.x
- **Logging**: Pino 9.x

### Quality Gates

Automated checks via `pnpm verify`:

- Workspace integrity (4 packages)
- Deep imports check (forbidden `@tracked/shared/src/*`)
- Lint (errors block, warnings OK)
- Typecheck
- Build

### Development Workflow

- One Story = One PR
- Epic order is mandatory
- Quality gates must pass before PR
- Scope discipline enforced
