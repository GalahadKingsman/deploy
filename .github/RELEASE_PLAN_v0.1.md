# План публикации v0.1.0 — Foundation Release

## ✅ Шаг 0 — Качество

```bash
pnpm verify
```

**Статус**: ✅ Все quality gates проходят

## 📋 Шаг 1 — Привести историю к чистой

### Текущая ситуация

- Ветка: `chore/monorepo-scaffold`
- Все Stories EPIC 0 в одной ветке
- Нет ветки `main`
- Нет remote

### Вариант A: Если это первый релиз (рекомендуется)

Создать `main` от текущего состояния и продолжить работу оттуда:

```bash
# Создать main ветку от текущего состояния
git checkout -b main

# Удалить старую story-ветку (опционально, после merge в main)
# git branch -d chore/monorepo-scaffold
```

### Вариант B: Если хотите сохранить историю Stories отдельно

1. Создать PR `chore/monorepo-scaffold` → `main`
2. Squash merge в main
3. Продолжить работу от main

**Рекомендация**: Вариант A (первый релиз, можно сразу создать main)

## 📝 Шаг 2 — Commit release docs

Release documentation уже закоммичена в коммитах:

- `63f8d39 docs: add README, CHANGELOG and v0.1 release notes`
- `30c252e docs: add GitHub repository setup instructions`

**Статус**: ✅ Готово

## 🚀 Шаг 3 — Push в GitHub

### 3.1 Создать приватный репозиторий на GitHub

1. Перейти на https://github.com/new
2. **Repository name**: `tracked-lms`
3. **Description**: `Telegram Mini App LMS - Version 0.1 Foundation`
4. **Visibility**: ✅ **Private**
5. **НЕ** инициализировать с README/.gitignore/license
6. Нажать "Create repository"

### 3.2 Добавить remote и запушить

```bash
# Добавить remote (замените YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/tracked-lms.git

# Или через SSH:
# git remote add origin git@github.com:YOUR_USERNAME/tracked-lms.git

# Проверить remote
git remote -v

# Запушить main ветку
git push -u origin main
```

## 🏷️ Шаг 4 — Tag (точка отката)

```bash
# Создать аннотированный tag
git tag -a v0.1.0 -m "Foundation release (EPIC 0)

- Monorepo scaffold (pnpm + Turborepo)
- Code quality tools (ESLint, Prettier, Husky)
- GitHub CI + PR template
- Docker Compose infrastructure
- Unified env validation
- API skeleton (NestJS + Fastify)
- WebApp skeleton (React + Vite)
- Bot skeleton (grammY)
- Shared package base
- Quality Gates system

See .github/RELEASE_v0.1.md for full details."

# Запушить tag
git push origin v0.1.0
```

## 📦 Шаг 5 — GitHub Release

1. Перейти в репозиторий на GitHub
2. Нажать "Releases" → "Draft a new release"
3. **Choose a tag**: `v0.1.0` (создать новый tag, если ещё не создан)
4. **Release title**: `v0.1.0 — Foundation (EPIC 0)`
5. **Description**: Скопировать содержимое из `.github/RELEASE_v0.1.md`
6. Нажать "Publish release"

## ✅ Проверка после публикации

```bash
# Проверить, что tag создан
git tag -l

# Проверить remote tags
git ls-remote --tags origin

# Убедиться, что main на GitHub
git ls-remote origin
```

## 🔄 После релиза

1. Продолжить работу от `main` ветки
2. Создавать новые feature-ветки от `main`
3. Следовать workflow: One Story = One PR

## ⚠️ Важно

- **НЕ** релизить из story-веток
- **НЕ** пропускать quality gates
- **НЕ** забывать про git tag для версионирования
- Всегда релизить из `main` или `release/*` ветки
