# Release v0.3.4.5 — Ban enforcement (Story 3.5), stable dev startup

## Summary

- **Story 3.5**: Banned users get 403 (USER_BANNED) on auth and protected routes; minimal audit log per denied request.
- **Dev**: One-command startup (`pnpm dev:app`), auto `.env` and JWT secret; API starts without TELEGRAM_BOT_TOKEN (503 on /auth/telegram if empty).
- **Fix**: JWT in ESM — `jwt.sign is not a function` resolved via createRequire.

## Changes

### Story 3.5 — Ban enforcement

- `packages/shared`: Error code `USER_BANNED`; ApiExceptionFilter uses custom `code` for 403.
- `infra/migrations/002_add_users_ban_and_audit_log.sql`: `users.banned_at`, `users.ban_reason`; table `audit_log`.
- API: TelegramAuthService — after upsert, if banned → 403 + audit; JWT guard — load user, if banned → 403 + audit. AuditService + audit_log write.
- DatabaseModule: ensure audit_log table and ban columns on init.

### Dev startup

- `tools/dev/ensure-env.mjs`: create `.env` from `.env.example` if missing; set `JWT_ACCESS_SECRET` (32 chars) if empty.
- `turbo.json`: dev task `dependsOn: ["^build"]`.
- `package.json`: `dev` = ensure-env + turbo dev; `dev:app` = ensure-env + turbo dev (api + webapp only).
- `packages/shared`: TELEGRAM_BOT_TOKEN optional (default ''); API returns 503 on POST /auth/telegram if empty.
- README: "Запуск проекта (одна схема)" with `pnpm dev:app`.

### Fix

- `apps/api/src/auth/session/jwt.service.ts`: load jsonwebtoken via `createRequire(import.meta.url)` so `jwt.sign`/`jwt.verify` work in ESM.

## Verification

```bash
pnpm verify
pnpm test:foundation
pnpm audit:architecture
pnpm dev:app   # API :3001, Webapp :5173
```

## Tag

```bash
git tag v0.3.4.5
git push origin main --tags
```
