# Release v0.1.0 — Foundation (EPIC 0)

## 🎯 Цель версии

Создать "рельсы" (foundation) для разработки Telegram Mini App LMS: monorepo структуру, инструменты качества, инфраструктуру и базовые скелеты всех приложений.

## ✅ Что сделано

### EPIC 0 — Foundation (12 Stories)

#### Story 0.1: Monorepo Scaffold

- ✅ pnpm workspace + Turborepo
- ✅ Структура: apps/api, apps/webapp, apps/bot, packages/shared
- ✅ Базовые TypeScript конфигурации
- ✅ Turbo tasks для build/typecheck/lint/dev

#### Story 0.2: Lint/Format Baseline + Husky

- ✅ ESLint flat config (TypeScript + React)
- ✅ Prettier конфигурация
- ✅ Husky pre-commit hooks
- ✅ lint-staged для автоматического форматирования

#### Story 0.3: GitHub CI + PR Template

- ✅ GitHub Actions CI workflow
- ✅ PR template для стандартизации
- ✅ Автоматические проверки на каждый PR

#### Story 0.4: Docker Compose Infrastructure

- ✅ PostgreSQL 16
- ✅ Redis 7
- ✅ MinIO (S3-compatible)
- ✅ Healthchecks для всех сервисов
- ✅ Runbook для локальной инфраструктуры

#### Story 0.5: Unified Env & Runtime Validation

- ✅ Zod schemas для env валидации
- ✅ Единые схемы для API, Bot, Webapp
- ✅ Secret masking в ошибках
- ✅ Runtime validation на старте приложений

#### Story 0.6: API Skeleton + /health + Request-ID + Logging

- ✅ NestJS + Fastify setup
- ✅ `/health` endpoint
- ✅ `x-request-id` header tracing
- ✅ Pino structured logging
- ✅ HTTP access logging

#### Story 0.7: Unified API Error Format

- ✅ Стандартизированные error codes
- ✅ Единый формат ошибок API
- ✅ Global exception filter
- ✅ traceId во всех ошибках

#### Story 0.8: Swagger /docs (dev-only)

- ✅ Swagger UI интеграция
- ✅ Документация API endpoints
- ✅ Примеры error responses

#### Story 0.9: WebApp Skeleton

- ✅ React + Vite setup
- ✅ React Router (3 tabs: Library, Learn, Account)
- ✅ Bottom navigation
- ✅ Safe-area handling для мобильных

#### Story 0.10: Bot Skeleton

- ✅ grammY framework
- ✅ `/start` command
- ✅ Error handling без утечки токенов

#### Story 0.11: ngrok Dev-Loop Helper

- ✅ ngrok setup инструкции
- ✅ Telegram dev runbook
- ✅ Helper scripts для публичного доступа

#### Story 0.12: Shared Base

- ✅ Структура contracts/errors/env
- ✅ Публичные экспорты (запрет deep imports)
- ✅ Pagination contracts
- ✅ README с правилами

#### Story 0.13: Quality Gates

- ✅ `pnpm verify` команда
- ✅ Автоматические проверки инвариантов
- ✅ Quality gates runbook
- ✅ Enforcement в Cursor rules

## 📦 Структура проекта

```
tracked-lms/
├── apps/
│   ├── api/          # NestJS + Fastify backend
│   ├── bot/          # grammY Telegram bot
│   └── webapp/       # React + Vite frontend
├── packages/
│   └── shared/       # Общие типы, контракты, валидация
├── infra/            # Docker Compose
├── tools/            # Утилиты (ngrok, verify)
├── docs/             # Документация
└── .github/          # CI, PR templates
```

## 🚀 Быстрый старт

```bash
# Установка
pnpm install

# Проверка
pnpm verify

# Разработка
pnpm dev

# Инфраструктура
docker compose -f infra/docker-compose.yml up -d
```

## 📚 Документация

- [Repository Workflow](./docs/runbooks/repo-workflow.md)
- [Quality Gates](./docs/runbooks/quality-gates.md)
- [Local Infrastructure](./docs/runbooks/local-infra.md)
- [Telegram Dev](./docs/runbooks/telegram-dev.md)

## 🔧 Quality Gates

Перед PR обязательно:

```bash
pnpm verify
```

Проверяет: workspace, deep imports, lint, typecheck, build

## 🎯 Следующие шаги

EPIC 1 — UI System + App Shell (дизайн-first на моках)

## 📝 Технический стек

- **Monorepo**: pnpm + Turborepo
- **Backend**: NestJS, Fastify, Pino
- **Frontend**: React, Vite, React Router
- **Bot**: grammY
- **Database**: PostgreSQL
- **Cache**: Redis
- **Storage**: MinIO
- **Validation**: Zod
