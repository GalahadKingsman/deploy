# Telegram Mini App Development Runbook

## Prerequisites

1. **Bot created in BotFather**
   - Create bot via [@BotFather](https://t.me/BotFather)
   - Get `BOT_TOKEN`
   - Store in `.env` (not committed to git)

2. **Webapp runs locally**
   - Port: `5173` (default)
   - Command: `pnpm --filter @tracked/webapp dev`
   - Verify: http://localhost:5173 opens

3. **ngrok installed and configured**
   - See [tools/ngrok/README.md](../../tools/ngrok/README.md)
   - Authtoken configured: `ngrok config add-authtoken YOUR_TOKEN`

## Quick Start (Copy-Paste)

### Terminal A: Webapp

```bash
pnpm --filter @tracked/webapp dev
```

Wait for: `Local: http://localhost:5173/`

### Terminal B: ngrok tunnel

```bash
ngrok http 5173
```

Copy the public URL (e.g., `https://xxxx.ngrok-free.app`)

**Verify**: Open the public URL in browser → should show webapp

### Terminal C: Bot

Create `apps/bot/.env` with `BOT_TOKEN=...` and `TELEGRAM_WEBAPP_URL=https://...` (no secrets in command line). Then:

```bash
pnpm --filter @tracked/bot dev
```

Bot should start and log: `Bot @your_bot_name started`

## Environment Variables

### Local `.env` (not committed)

Root `.env` or **`apps/bot/.env`** (Story 3.4+) for bot:

```env
BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBAPP_URL=https://xxxx.ngrok-free.app
```

**Important**: `.env` is in `.gitignore`, never commit tokens or URLs. **Do not** pass `BOT_TOKEN=...` in the command line (visible in `pgrep`/`ps`).

## Free ngrok workflow (Story 3.4)

1. **Ensure ngrok is not running twice** (otherwise ERR_NGROK_334):

   ```bash
   pnpm run:protocol -- pgrep -fl ngrok
   ```

   If any process is listed, stop it:

   ```bash
   pnpm run:protocol -- pkill ngrok
   ```

2. **Start WebApp tunnel** (long-running). Use **127.0.0.1:5173** to avoid ERR_NGROK_8012 (webapp listens on 5173, strictPort in Vite):

   ```bash
   curl -I http://127.0.0.1:5173/
   ```

   Expect 200/304. Then:

   ```bash
   pnpm run:protocol --timeout-ms=600000 -- ngrok http 127.0.0.1:5173
   ```

   Copy the **https** URL (it changes on free tier).

3. **Store secrets in `apps/bot/.env`** (gitignored):

   ```env
   BOT_TOKEN=...
   TELEGRAM_WEBAPP_URL=https://<your-ngrok-url>
   ```

   **Forbidden:** running with `BOT_TOKEN=...` in the command (token visible in process list).

4. **Start bot:**

   ```bash
   pnpm run:protocol --timeout-ms=600000 -- pnpm --filter @tracked/bot dev
   ```

5. **Verify in Telegram:** `/start` → **Open WebApp** → WebApp opens.

6. **When ngrok URL changes:** update `TELEGRAM_WEBAPP_URL` in `apps/bot/.env` and restart the bot (no WebApp code changes).

## Troubleshooting

### "Blocked request. This host is not allowed. Add to server.allowedHosts"

- Vite blocks requests when the `Host` header is not in the allowed list.
- **Fix:** `apps/webapp/vite.config.ts` already allows ngrok in development via `server.allowedHosts`: `.ngrok-free.dev`, `.ngrok-free.app`, `.ngrok-free.de` (wildcard subdomains).
- If you see this error, restart the WebApp dev server so it picks up the config.

### "invalid host header" / CORS

- This is normal for ngrok
- Webapp should handle ngrok headers correctly
- If issues persist, check webapp CORS settings

### "ngrok authtoken missing"

```bash
ngrok config add-authtoken YOUR_TOKEN
```

Verify: `ngrok config check`

### Telegram cache issues

- **Bot restart**: Stop and restart bot (Terminal C)
- **Webapp cache**: Clear browser cache or use incognito
- **Telegram cache**: Close and reopen Telegram Mini App

### Port already in use

```bash
# Check what's using port 5173
lsof -i :5173

# Kill process if needed
kill -9 <PID>
```

### ngrok URL changes on restart

- ngrok free tier: URL changes on each restart
- Update `TELEGRAM_WEBAPP_URL` in `.env` after each ngrok restart
- On Story 1.1, bot will read from env automatically

### «Ничего не работает» после /start → Open WebApp

Проверь по порядку:

1. **Webapp запущен** на том порту, на который смотрит ngrok (часто 5173 или 5174):

   ```bash
   VITE_API_BASE_URL=http://localhost:3001 VITE_REAL_API=1 pnpm --filter @tracked/webapp dev
   ```

   Без `VITE_API_BASE_URL` приложение откроется, но авторизация не сработает (появится экран «Не удалось подключиться»).

2. **API запущен** (из корня репо, с `.env`):

   ```bash
   cd /path/to/repo && node apps/api/dist/apps/api/src/main.js
   ```

   Или через симлинк `apps/api/.env` → корневой `.env`: `cd apps/api && node dist/apps/api/src/main.js`.

3. **ngrok** туннелирует порт webapp (например 5174):

   ```bash
   ngrok http 5174
   ```

   В корневом `.env` (или `apps/bot/.env`) задай `TELEGRAM_WEBAPP_URL=https://<твой-ngrok-url>` (без слэша в конце).

4. **Бот запущен** и читает тот же `.env`:

   ```bash
   pnpm --filter @tracked/bot dev
   ```

5. **Открываешь с компьютера (Telegram Desktop):** `VITE_API_BASE_URL=http://localhost:3001` достаточно — браузер мини-приложения идёт на твой localhost.

6. **Открываешь с телефона:** с телефона `localhost:3001` недоступен. Нужен второй туннель для API (например `ngrok http 3001` в другом терминале) и запуск webapp с `VITE_API_BASE_URL=https://<api-ngrok-url>`.

## Development Workflow

1. Start webapp: `pnpm --filter @tracked/webapp dev`
2. Start ngrok: `ngrok http 5173`
3. Copy public URL to `apps/bot/.env`: `TELEGRAM_WEBAPP_URL=https://xxxx.ngrok-free.app` (and `BOT_TOKEN=...`)
4. Start bot: `pnpm --filter @tracked/bot dev` (env from `.env`, no token in command)
5. Test in Telegram: Send `/start` → click **Open WebApp** → Mini App opens

## Helper Scripts

From root:

```bash
# Start webapp dev server
pnpm dev:webapp

# Show instructions for public dev setup
pnpm dev:public
```
