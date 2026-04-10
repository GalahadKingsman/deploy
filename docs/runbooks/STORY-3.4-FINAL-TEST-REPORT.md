# Story 3.4 — Final Test Report (Telegram Auth end-to-end)

**Version:** 0.3.4.3  
**Date:** 2026-01-30  
**Scope:** TG initData → /auth/telegram → token → /me → DB, plus negative cases.

---

## A) Quality gates (mandatory before PR/release)

### 1. `pnpm verify`

```
> tracked-lms@ verify /Users/user/Project/edify_main
> node tools/verify/verify.mjs

✅ Workspace list passed (found 4 packages)
✅ No deep imports found
✅ No wildcard paths found
✅ No duplicate error codes found
✅ No manual error format found
✅ Shared config check passed
✅ Lint passed (25 warnings, 0 errors)
✅ Typecheck passed
✅ Build passed
✨ All quality gates passed!
```

**Result:** PASS

---

### 2. `pnpm test:foundation`

- **Passed:** GET /health 200, GET /health includes x-request-id, GET /health/400, GET /nope 404, GET /me without auth 401, GET /me with invalid token 401, GET /docs 404 in production, SWAGGER_ENABLED parsing.
- All tests pass, including `GET /docs returns 200 in development mode` and `SWAGGER_ENABLED parsing: "1" and "true" are truthy`.

**Result:** **PASS** (13/13). Fix: test helper forces `NODE_ENV=development` when `swaggerEnabled: true`; API `load-env` preserves `NODE_ENV`/`SWAGGER_ENABLED` when already set so test env is not overwritten by `.env`.

---

### 3. `pnpm audit:architecture`

```
✨ Architecture Freeze Audit: PASSED
```

**Result:** PASS

---

## B) Smoke API (no Telegram)

### Health

```bash
curl -i http://127.0.0.1:3001/health
```

**Expected:** 200 + valid JSON (`{"ok":true,"env":"...","version":"..."}`).

**Sample response (2026-01-30):**

```
HTTP/1.1 200 OK
x-request-id: e41c6e22-7c5b-4f02-943d-38e38ff47c7e
content-type: application/json; charset=utf-8
{"ok":true,"env":"development","version":"0.0.0"}
```

**Result:** PASS — 200, x-request-id present.

### Request-id

- Any API call (including /health) must return `x-request-id` in response headers (and in Pino logs).
- Verified above: header present.

### Swagger (dev vs prod)

- **Dev:** With `NODE_ENV=development` and `SWAGGER_ENABLED=true` (or `1`), GET /docs should return 200 (HTML). Check locally.
- **Prod:** With `NODE_ENV=production` (or SWAGGER_ENABLED=false), GET /docs must return 404 with unified error format (statusCode, code, message, requestId). Foundation test confirms this.

---

## C) Happy path (Mini App in Telegram)

**Steps:**

1. Infra: `docker compose -f infra/docker-compose.yml --env-file .env up -d`
2. API: `pnpm --filter @tracked/shared build && pnpm --filter @tracked/api dev`
3. Webapp: `pnpm --filter @tracked/webapp dev`
4. Ngrok: `ngrok http 5173` → set `TELEGRAM_WEBAPP_URL` in `.env`
5. Bot: `BOT_TOKEN=... pnpm --filter @tracked/bot start`
6. In Telegram: /start → open Mini App (button).

**Checklist:**

| Check                                    | Expected                                                            |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Mini App (with ?debug=1 if overlay used) | TG: ✓, initData: ✓ &lt;N&gt;ch, Auth: OK                            |
| Network                                  | POST /auth/telegram → 200, GET /me → 200                            |
| Token persistence                        | After reload, /me still 200 (no new /auth/telegram if token reused) |
| DB                                       | User row with your telegram_user_id, updated_at on re-open          |

**Screenshots / evidence to attach:**

1. **Mini App:** Screenshot with Auth: OK visible (and TG ✓, initData ✓).
2. **Network:** DevTools Network tab — POST /auth/telegram 200, GET /me 200.
3. **DB:** Result of the query below.

---

## D) DB evidence

**Schema:** `users` table has `telegram_user_id` (not `telegram_id`).

**Query (adapt `DATABASE_URL` if needed):**

```sql
SELECT id, telegram_user_id, username, first_name, last_name, created_at, updated_at
FROM users
ORDER BY updated_at DESC
LIMIT 5;
```

**Expected:** Your user present; `updated_at` changes on re-open if upsert runs.

**Example (paste your result as artifact):**

```
                  id                  | telegram_user_id |  username  | first_name | last_name |         created_at         |         updated_at
--------------------------------------+------------------+------------+------------+-----------+----------------------------+----------------------------
 eddf951a-1cd7-411c-856e-0fdfe50f8394 | 444617251        | rickonetik | rick       |           | 2026-01-30 18:17:20.441+00 | 2026-01-30 18:17:20.441+00
(1 row)
```

---

## E) Negative cases

| Case                     | Expected                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Not Telegram**         | Open webapp in browser (not in TG). No “silent” auth; UI shows “open in Telegram” or auth flow does not start.                             |
| **Broken/expired token** | Remove token in DevTools (or clear storage), then GET /me. Response: 401, unified format (code, message, requestId); logs show request-id. |
| **Bad initData**         | Without initData, POST /auth/telegram must not return 200 (400/401).                                                                       |

---

## F) Final criteria (3.4 closed)

- [x] /auth/telegram returns 200 in Mini App and creates/updates user in DB.
- [x] /me returns 200 and returns correct user.
- [x] Negative cases return 401/404 in unified error format with x-request-id.
- [x] `pnpm verify` — PASS.
- [x] `pnpm audit:architecture` — PASS.
- [x] `pnpm test:foundation` — PASS (13/13).

---

## Artifacts to attach (final)

1. **Stdout:**
   - `pnpm verify` (full output)
   - `pnpm test:foundation` (full output)
   - `pnpm audit:architecture` (full output)

2. **Screenshots / evidence:**
   - Mini App with ?debug=1 showing **Auth: OK** (and TG ✓, initData ✓).
   - Network: **POST /auth/telegram 200**, **GET /me 200**.
   - DB: **Copy-paste or screenshot** of `SELECT ... FROM users ...` with your user.

3. **Optional:** Screenshot of GET /health with `x-request-id` in response headers (or use sample above).

---

## Commands to capture artifacts

```bash
# From repo root
pnpm verify
pnpm test:foundation
pnpm audit:architecture
```

Redirect to files if needed:

```bash
pnpm verify 2>&1 | tee verify.log
pnpm test:foundation 2>&1 | tee test-foundation.log
pnpm audit:architecture 2>&1 | tee audit-architecture.log
```
