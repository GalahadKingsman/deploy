# Mini App не подтягивает профиль — triage env и кейсы

## Исключить «env из shell победил .env»

В той же сессии терминала, откуда запускаешь API:

```bash
printenv TELEGRAM_BOT_TOKEN | wc -c
printenv JWT_ACCESS_SECRET | wc -c
```

Или одной строкой: `printenv TELEGRAM_BOT_TOKEN | wc -c; printenv JWT_ACCESS_SECRET | wc -c`

**Ожидание:** оба **0**. Если внезапно не ноль — перед запуском API сделать `unset TELEGRAM_BOT_TOKEN JWT_ACCESS_SECRET`.
Если числа **> 0**, переменные уже выставлены в окружении до загрузки `.env` и после логики «restore» могут перетирать `.env`.

**Контрольный запуск (100% использовать .env):**

```bash
# Остановить API (Ctrl+C)
unset TELEGRAM_BOT_TOKEN JWT_ACCESS_SECRET
pnpm --filter @tracked/api dev
```

Открыть Mini App заново (закрыть/открыть в Telegram). Если профиль снова подтягивается — причина была в экспортированных переменных в shell/скрипте.

## Фактический статус запросов (Mini App с ?debug=1)

В overlay + Network смотреть:

| Запрос                  | Что проверить                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| **POST /auth/telegram** | Статус + тело ответа                                                                                         |
| **GET /me**             | Статус + тело; в Request Headers — есть ли `Authorization: Bearer ...`; **URL** (не уехал ли на другой хост) |

Дальше по кейсу:

- **A — /auth/telegram = 503**  
  API считает, что нет/невалидный bot token.  
  Фикс: контрольный запуск с `unset ...`; в `.env` без кавычек и пробелов: `TELEGRAM_BOT_TOKEN=123:ABC...`

- **B — /auth/telegram = 401/400**  
  Verify initData не прошёл или initData пустой.  
  Фикс: Mini App открыт из Telegram; в payload POST /auth/telegram поле `initData` не пустое (если пусто — регрессия во фронте, не берётся `Telegram.WebApp.initData`).

- **C — /auth/telegram = 200, но /me = 401**  
  JWT-слой: токен не прикладывается или не принимается.  
  Если нет `Authorization` → проблема webapp storage/bootstrap (токен не сохранился/не читается).  
  Если `Authorization` есть → токен невалиден (часто после смены секрета или хранения под другим origin).  
  **Быстрый фикс:** очистить токен в storage для текущего домена (DevTools → Application → Local Storage/Session Storage); полностью закрыть Mini App и открыть снова (bootstrap повторит /auth/telegram).  
  Также: один и тот же origin для /auth/telegram и /me (VITE_API_BASE_URL / прокси).

- **D — /me = 403, в теле USER_BANNED**  
  Не регрессия, бан по 3.5. Разбанить по `telegram_user_id`.

- **E — оба 200, но UI «Пользователь»**  
  Проблема в UI: useMe/React Query, MSW/моки, компонент читает не тот источник. Проверить USE_MSW/REAL_API и что профиль использует `useMe()`.

## Телеметрия env в API (dev-only)

При `NODE_ENV=development` в логах старта API выводится (без утечки секретов):

```
[load-env] TELEGRAM_BOT_TOKEN: set=true len=46 sha=ab12cd | JWT_ACCESS_SECRET: set=true len=32 sha=98fe10
```

По `len` и `sha` можно убедиться, что процесс использует ожидаемые значения (и не «старый» token из окружения). Критично: **set=true** для обоих; **sha/len не меняются** между перезапусками (иначе токены реально «прыгают»).

---

## Чеклист для отчёта

1. Выполнить две команды `printenv ... | wc -c` (раздельно или через `;`) → записать оба числа (ожидание: 0).
2. Перезапустить API, сохранить одну строку телеметрии `[load-env] ...` (len+sha).
3. В Mini App с `?debug=1` зафиксировать:
   - статус и тело **POST /auth/telegram**;
   - статус и тело **GET /me**;
   - наличие **Authorization** у /me;
   - **URL** запросов (одинаковый origin или нет).
4. Действовать по кейсу A–E выше.

---

## Один короткий прогон (runbook / PR)

Краткий прогон для проверки env и Mini App; результат можно вставить в PR-комментарий.

### 1. printenv (в терминале, откуда запускаешь API)

```bash
printenv TELEGRAM_BOT_TOKEN | wc -c; printenv JWT_ACCESS_SECRET | wc -c
```

**Ожидание:** `0` и `0`.

### 2. Строка телеметрии при старте API (dev-only)

Перезапустить API, взять один лог вида:

```
[load-env] TELEGRAM_BOT_TOKEN: set=true len=.. sha=...... | JWT_ACCESS_SECRET: set=true len=.. sha=......
```

**Ожидание:** `set=true` для обоих; `len`/`sha` стабильны между перезапусками.

### 3. Mini App с ?debug=1

| Проверка                 | Ожидание                                   |
| ------------------------ | ------------------------------------------ |
| POST /auth/telegram      | 200                                        |
| GET /me                  | 200                                        |
| У GET /me есть заголовок | Authorization: Bearer ...                  |
| URL запросов             | ожидаемый хост (не уехал на другой origin) |

### Пример результата прогона (2026-01-30)

- **printenv:** `0` и `0`
- **Телеметрия:** `[load-env] TELEGRAM_BOT_TOKEN: set=true len=46 sha=4ae892 | JWT_ACCESS_SECRET: set=true len=61 sha=493463`
- **Mini App:** POST /auth/telegram = 200, GET /me = 200, Authorization есть, URL — ожидаемый хост
