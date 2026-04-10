# Foundation Release Candidate Checklist

**Purpose**: Verify that EPIC 0 Foundation is ready for EPIC 1.

**When to run**: Before starting EPIC 1, after completing Story 0.17.

## A. Clean Clone Gate (Critical)

**Goal**: Any developer/CI server gets green result from scratch.

### Commands

```bash
git clone --depth 1 <repo> && cd edify
pnpm i --frozen-lockfile
pnpm verify
pnpm start:api  # or pnpm dev:api
# In another terminal:
curl http://localhost:3001/health
```

### Expected

- `pnpm verify` = PASS without preliminary builds/manual steps
- `pnpm start:api` (or `pnpm dev:api`) starts successfully
- `curl http://localhost:3001/health` returns 200 OK
- All quality gates pass
- No errors or warnings
- No "Cannot find module" or "ERR_MODULE_NOT_FOUND" errors

## B. Quality Gates (Automatic)

### Commands

```bash
pnpm verify
```

### Expected

- ✅ Workspace sees all packages
- ✅ Deep imports = 0
- ✅ Wildcard paths for shared = forbidden and checked
- ✅ Shared Config check passes:
  - `strict: true`
  - `target: ES2022`
  - `module: CommonJS`
  - `moduleResolution: Node`
  - No paths from base config (shared tsconfig doesn't extend base)
- ✅ Lint/typecheck/build = PASS

### Manual Check: Shared Config

```bash
tsc -p packages/shared/tsconfig.json --showConfig | grep -E '"strict"|"target"|"module"|"moduleResolution"'
```

Expected output should show:

- `"strict": true`
- `"target": "ES2022"`
- `"module": "CommonJS"`
- `"moduleResolution": "Node"`

### Paths/Aliases Consistency

- ✅ Shared package does not use TypeScript paths that are not available in other packages
- ✅ No `@tracked/shared/*` deep imports (only root `@tracked/shared` allowed)
- ✅ Base config paths are only for typecheck, not for runtime

## C. API HTTP Contract (Smoke, Deterministic)

### Commands

```bash
pnpm test:foundation
```

### Expected

- ✅ `/health` always returns 200 and includes `x-request-id`
- ✅ `traceId` in logs matches `x-request-id`
- ✅ Error format:
  - 404/400/500 always `{ statusCode, code, message, traceId, details? }`
  - `traceId` never "unknown"
  - Stack/secrets never leak

## D. Swagger Gating (dev-only)

### Expected

- ✅ `NODE_ENV=development` → `/docs` accessible (200)
- ✅ `NODE_ENV=production` → `/docs` strictly 404 in unified error format

**Note**: If this test flakes even once, it's a gap in the foundation rails.

## E. WebApp Minimal Integrity

### Commands

```bash
pnpm --filter @tracked/webapp build
pnpm --filter @tracked/webapp dev  # (locally)
```

### Expected

- ✅ Routes `/library`, `/learn`, `/account` are live
- ✅ `/` redirects to `/learn`
- ✅ Safe-area doesn't overlap content with tabbar

## F. Bot Guardrails

### Commands

```bash
# Without BOT_TOKEN
pnpm --filter @tracked/bot start

# With BOT_TOKEN
BOT_TOKEN=... pnpm --filter @tracked/bot start
# Then test /start command in Telegram
```

### Expected

- ✅ Without token: bot doesn't start
- ✅ Token never logged anywhere

## G. Infrastructure (Optional, Manual)

### Commands

```bash
docker compose -f infra/docker-compose.yml --env-file .env up -d
psql -h localhost -U postgres -d edify -c "SELECT 1"
redis-cli ping
# Open MinIO console: http://localhost:9001
```

### Expected

- ✅ PostgreSQL accessible
- ✅ Redis responds to ping
- ✅ MinIO console opens

## H. CI Status (GitHub Actions)

### Check

- Open: https://github.com/rickonetik/edify/actions
- Verify latest run on `main` is green

### Expected

- ✅ Latest CI run = green
- ✅ All quality gates pass in CI

## Final Checklist

- [ ] Clean clone: `git clone`, `pnpm i --frozen-lockfile`, `pnpm verify` = PASS
- [ ] Quality gates: `pnpm verify` = PASS
- [ ] Foundation tests: `pnpm test:foundation` = PASS (all tests, including Swagger)
- [ ] WebApp: routes work, safe-area correct
- [ ] Bot: validation works, token not logged
- [ ] Infrastructure: services accessible (if testing locally)
- [ ] CI: latest run on `main` = green

**If all checks pass → Ready for EPIC 1** 🚀
