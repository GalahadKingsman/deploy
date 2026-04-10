# Release v0.3.5 — Mini App env check runbook, PR checklist

## Summary

- **Runbook**: Один короткий прогон (printenv, телеметрия [load-env], Mini App ?debug=1); кейсы A–E; чеклист для отчёта.
- **PR**: Шаблон `.github/MINI_APP_ENV_CHECK_PR.md` для вставки результата прогона в PR-комментарий.

## Changes

- `docs/runbooks/mini-app-env-triage.md`: раздел «Один короткий прогон (runbook / PR)»; ожидание printenv «0 и 0»; проверка URL; быстрый фикс кейса C; требование стабильных len/sha; пример прогона.
- `.github/MINI_APP_ENV_CHECK_PR.md`: чеклист printenv + телеметрия + Mini App и блок «Результат прогона» для копирования в PR.

## Verification

```bash
pnpm verify
pnpm test:foundation
pnpm dev:app   # API :3001, Webapp :5173; в логах [load-env] TELEGRAM_BOT_TOKEN: set=... | JWT_ACCESS_SECRET: set=...
```

Runbook: [docs/runbooks/mini-app-env-triage.md](../docs/runbooks/mini-app-env-triage.md).

## Tag

```bash
git tag v0.3.5
git push origin main --tags
```
