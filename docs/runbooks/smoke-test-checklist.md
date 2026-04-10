# Foundation Smoke Test Checklist

Manual verification checklist for EPIC 0 Foundation before starting EPIC 1.

## Prerequisites

```bash
pnpm i --frozen-lockfile
pnpm verify  # Must pass
```

## A) API Tests

### Start API

```bash
pnpm --filter @tracked/api start
# Or: pnpm --filter @tracked/api dev
```

### Test /health

```bash
curl -i http://localhost:3001/health
```

**Expected:**

- ✅ Status: 200 OK
- ✅ Header: `x-request-id` present
- ✅ Body: `{ ok: true, env: "...", version: "..." }`

### Test 404 (/nope)

```bash
curl -i http://localhost:3001/nope
```

**Expected:**

- ✅ Status: 404
- ✅ Header: `x-request-id` present
- ✅ Body: `{ statusCode: 404, code: "NOT_FOUND", message: "...", traceId: "..." }`
- ✅ `traceId` === `x-request-id` header value

### Test 400 (/health/400)

```bash
curl -i http://localhost:3001/health/400
```

**Expected:**

- ✅ Status: 400
- ✅ Header: `x-request-id` present
- ✅ Body: `{ statusCode: 400, code: "VALIDATION_ERROR", message: "...", traceId: "...", details: [...] }`
- ✅ `details` is an array
- ✅ `traceId` === `x-request-id` header value

### Test /docs in Development

```bash
# Ensure NODE_ENV=development (default)
curl -i http://localhost:3001/docs
```

**Expected:**

- ✅ Status: 200
- ✅ Content-Type: `text/html`
- ✅ Swagger UI HTML content

### Test /docs in Production

```bash
# Stop API, restart with NODE_ENV=production
NODE_ENV=production pnpm --filter @tracked/api start
curl -i http://localhost:3001/docs
```

**Expected:**

- ✅ Status: 404
- ✅ Body: `{ statusCode: 404, code: "NOT_FOUND", message: "...", traceId: "..." }`
- ✅ Header: `x-request-id` present

## B) WebApp Tests

### Start WebApp

```bash
pnpm dev:webapp
```

### Test Routing

1. Open `http://localhost:5173/`
   - ✅ Should redirect to `/learn`

2. Navigate to `/library`
   - ✅ Library page loads
   - ✅ Bottom tab "Библиотека" is active

3. Navigate to `/learn`
   - ✅ Learn page loads
   - ✅ Bottom tab "Обучение" is active (highlighted)

4. Navigate to `/account`
   - ✅ Account page loads
   - ✅ Bottom tab "Профиль" is active

### Test Safe Area

1. Open DevTools → Device Toolbar
2. Select iPhone viewport (e.g., iPhone 14 Pro)
3. Scroll to bottom of Learn page (long content)
4. Check:
   - ✅ Bottom tabbar does NOT overlap content
   - ✅ Content is scrollable
   - ✅ Safe area insets applied (padding-bottom on tabbar)

## C) Bot Tests

### Test Without BOT_TOKEN

```bash
# Unset BOT_TOKEN
unset BOT_TOKEN
pnpm --filter @tracked/bot start
```

**Expected:**

- ✅ Bot does NOT start
- ✅ Error message masks token (no `BOT_TOKEN` visible in logs)
- ✅ Exit code non-zero

### Test With BOT_TOKEN

```bash
BOT_TOKEN=your_test_token pnpm --filter @tracked/bot start
```

**Expected:**

- ✅ Bot starts successfully
- ✅ Log: "Bot @your_bot_name started"
- ✅ In Telegram: `/start` command responds with "Edify bot is running. Use the Mini App button soon."

## D) Dev Loop Test

### Test dev:public Helper

```bash
# With port closed
pnpm dev:public
```

**Expected:**

- ✅ Shows warning: "Port 5173 is not listening"
- ✅ Shows instruction: "Start webapp first: pnpm dev:webapp"

```bash
# With port open (in another terminal: pnpm dev:webapp)
pnpm dev:public
```

**Expected:**

- ✅ Shows: "Port 5173 is listening"
- ✅ Shows ngrok instructions
- ✅ Shows link to runbook

## Automated Tests

Run foundation smoke tests:

```bash
pnpm test:foundation
```

**Expected:**

- ✅ All tests pass
- ✅ API starts and stops correctly
- ✅ All endpoints return correct format

## Final Checklist

- [ ] `pnpm verify` passes
- [ ] `pnpm test:foundation` passes
- [ ] API health endpoint works
- [ ] API error format is unified
- [ ] Swagger gating works (dev vs production)
- [ ] WebApp routing works
- [ ] WebApp safe area works
- [ ] Bot validation works
- [ ] Bot /start command works
- [ ] dev:public helper works

If all checks pass → **Ready for EPIC 1** 🚀
