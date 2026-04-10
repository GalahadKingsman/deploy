# tracked-lms

Telegram Mini App для обучения (LMS) с интеграцией бота и веб-приложения.

## Version 0.1 — Foundation (EPIC 0)

Первая версия проекта содержит "рельсы" (foundation) для разработки: monorepo структуру, инструменты качества, инфраструктуру и базовые скелеты приложений.

### Что включено в v0.1

#### 🏗️ Monorepo Infrastructure

- **pnpm workspace** — управление пакетами в monorepo
- **Turborepo** — кэширование и параллельная сборка
- **TypeScript** — единая конфигурация для всех пакетов
- **Структура**:
  - `apps/api` — NestJS + Fastify backend
  - `apps/webapp` — React + Vite frontend
  - `apps/bot` — grammY Telegram bot
  - `packages/shared` — общие типы, контракты, валидация

#### 🔧 Code Quality Tools

- **ESLint** — линтинг с flat config
- **Prettier** — форматирование кода
- **Husky + lint-staged** — pre-commit hooks
- **GitHub Actions CI** — автоматические проверки на PR
- **Quality Gates** — система проверки инвариантов (`pnpm verify`)

#### 📦 Environment & Validation

- **Zod schemas** — runtime валидация env переменных
- **Unified env** — единые схемы для всех приложений
- **Secret masking** — безопасный вывод ошибок валидации

#### 🐳 Local Infrastructure

- **Docker Compose** — PostgreSQL, Redis, MinIO
- **Healthchecks** — автоматическая проверка готовности сервисов
- **Runbooks** — документация по запуску и управлению

#### 🚀 Application Skeletons

- **API** (`apps/api`):
  - NestJS + Fastify
  - `/health` endpoint
  - Unified error format
  - Request ID tracing (`x-request-id`)
  - Pino logging
  - Swagger UI (`/docs` в dev режиме)

- **WebApp** (`apps/webapp`):
  - React + Vite
  - React Router (3 tabs: Library, Learn, Account)
  - Bottom navigation
  - Safe-area handling для мобильных устройств

- **Bot** (`apps/bot`):
  - grammY framework
  - `/start` command
  - Error handling без утечки токенов

#### 📚 Documentation

- **Runbooks**:
  - `repo-workflow.md` — workflow разработки
  - `quality-gates.md` — система проверок
  - `local-infra.md` — локальная инфраструктура
  - `telegram-dev.md` — разработка Telegram Mini App
- **PR Template** — стандартизация pull requests
- **Cursor Rules** — правила для AI-ассистента

#### 🛠️ Development Tools

- **ngrok helper** — инструкции для публичного доступа к webapp
- **Verify script** — автоматическая проверка quality gates
- **Dev scripts** — удобные команды для разработки

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9.0.0+
- Docker Desktop (для локальной инфраструктуры)

### Installation

```bash
# Клонировать репозиторий
git clone <repository-url>
cd tracked-lms

# Установить зависимости
pnpm install

# Проверить workspace
pnpm verify
```

### Запуск проекта (одна схема)

Перед первым запуском ничего вручную не нужно: скрипт сам создаёт `.env` из `.env.example` и подставляет `JWT_ACCESS_SECRET`, если его нет.

```bash
# API + Webapp (рекомендуется для разработки)
pnpm dev:app
```

- **API**: http://localhost:3001
- **Webapp**: http://localhost:5173 (если порт занят — Vite возьмёт следующий, например 5174)

Для Telegram-авторизации в Mini App в `.env` нужно задать `TELEGRAM_BOT_TOKEN` (без него POST /auth/telegram вернёт 503).

```bash
# Все приложения (API + Webapp + Bot)
pnpm dev
```

Бот требует `BOT_TOKEN` в `.env`; если его нет, процесс бота упадёт при старте.

### Infrastructure

```bash
# Запустить инфраструктуру (Postgres, Redis, MinIO)
pnpm infra:up

# Миграции (если используете БД)
pnpm db:migrate

# Остановить
pnpm infra:down
```

### Quality Gates

```bash
# Запустить все проверки
pnpm verify

# Отдельные проверки
pnpm verify:workspace
pnpm verify:deep-imports
```

**Foundation tests** (`pnpm test:foundation`): требуют `JWT_ACCESS_SECRET`; без него API не стартует и тесты, поднимающие API, падают. Для RBAC-тестов нужны также `DATABASE_URL` и инфраструктура (см. runbook Story 4.1).

## Project Structure

```
tracked-lms/
├── apps/
│   ├── api/          # NestJS + Fastify backend
│   ├── bot/          # grammY Telegram bot
│   └── webapp/       # React + Vite frontend
├── packages/
│   └── shared/       # Общие типы, контракты, валидация
├── infra/            # Docker Compose для локальной разработки
├── tools/            # Утилиты (ngrok, verify)
├── docs/             # Документация и runbooks
└── .github/          # GitHub Actions, PR templates
```

## Commands

### Root Level

- `pnpm verify` — проверить все quality gates
- `pnpm build` — собрать все пакеты
- `pnpm typecheck` — проверить типы
- `pnpm lint` — запустить линтер
- `pnpm dev` — запустить все приложения в dev режиме

### Package Level

- `pnpm --filter @tracked/api <command>`
- `pnpm --filter @tracked/webapp <command>`
- `pnpm --filter @tracked/bot <command>`
- `pnpm --filter @tracked/shared <command>`

## Quality Gates

Перед созданием PR обязательно запустить:

```bash
pnpm verify
```

Проверяет:

- ✅ Workspace integrity (4 пакета)
- ✅ Deep imports (запрещены `@tracked/shared/src/*`)
- ✅ Lint (errors блокируют, warnings OK)
- ✅ Typecheck
- ✅ Build

Подробнее: [docs/runbooks/quality-gates.md](./docs/runbooks/quality-gates.md)

## Documentation

- [Repository Workflow](./docs/runbooks/repo-workflow.md)
- [Quality Gates](./docs/runbooks/quality-gates.md)
- [Local Infrastructure](./docs/runbooks/local-infra.md)
- [Telegram Dev](./docs/runbooks/telegram-dev.md)
- [EPICs Outline](./docs/runbooks/epics-outline.md)

## Development Workflow

1. **One Story = One PR** — каждая Story в отдельном PR
2. **Epic Order** — порядок EPIC'ов обязателен
3. **Quality Gates** — `pnpm verify` должен быть зелёным перед PR
4. **Scope Discipline** — не менять файлы вне scope текущей Story

## Technology Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Backend**: NestJS, Fastify, Pino
- **Frontend**: React, Vite, React Router
- **Bot**: grammY
- **Database**: PostgreSQL
- **Cache**: Redis
- **Storage**: MinIO (S3-compatible)
- **Validation**: Zod
- **Linting**: ESLint, Prettier

## License

Private repository.

## Version History

### 0.1.0 (Foundation)

- ✅ Monorepo scaffold (Story 0.1)
- ✅ Lint/format baseline + husky (Story 0.2)
- ✅ GitHub CI + PR template (Story 0.3)
- ✅ Docker Compose infrastructure (Story 0.4)
- ✅ Unified env & runtime validation (Story 0.5)
- ✅ API skeleton + /health + request-id + logging (Story 0.6)
- ✅ Unified API error format (Story 0.7)
- ✅ Swagger /docs (dev-only) (Story 0.8)
- ✅ WebApp skeleton (router 3 tabs + safe-area) (Story 0.9)
- ✅ Bot skeleton (grammY + /start) (Story 0.10)
- ✅ ngrok dev-loop helper (Story 0.11)
- ✅ Shared base (contracts/errors/env exports) (Story 0.12)
- ✅ Quality Gates: pnpm verify + runbook (Story 0.13)
#   d e p l o y  
 