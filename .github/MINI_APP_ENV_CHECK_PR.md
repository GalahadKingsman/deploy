# Mini App env check (один короткий прогон)

Скопировать в PR-комментарий после прогона.

---

## Прогон

**1. printenv** (в терминале, откуда запускаешь API)

```bash
printenv TELEGRAM_BOT_TOKEN | wc -c; printenv JWT_ACCESS_SECRET | wc -c
```

Ожидание: `0` и `0`.

**2. Телеметрия при старте API (dev-only)**

Один лог при старте:

```
[load-env] TELEGRAM_BOT_TOKEN: set=true len=.. sha=...... | JWT_ACCESS_SECRET: set=true len=.. sha=......
```

Ожидание: `set=true` для обоих; len/sha стабильны между перезапусками.

**3. Mini App с ?debug=1**

| Проверка                 | Ожидание                                   |
| ------------------------ | ------------------------------------------ |
| POST /auth/telegram      | 200                                        |
| GET /me                  | 200                                        |
| У GET /me есть заголовок | Authorization: Bearer ...                  |
| URL запросов             | ожидаемый хост (не уехал на другой origin) |

---

## Результат прогона (заполнить)

- **printenv:** _0 и 0_
- **Телеметрия:** _вставить одну строку [load-env] ..._
- **Mini App:** POST /auth/telegram = _?_ , GET /me = _?_ , Authorization _есть / нет_ , URL _ожидаемый / другой_

Runbook: `docs/runbooks/mini-app-env-triage.md`
