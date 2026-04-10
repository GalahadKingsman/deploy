# Story 5.4 — WebApp: «Стать экспертом» (student default + onboarding + 0₽ заявка)

**Purpose**: На экране Account показывать блок «Стать экспертом» с 3 состояниями (NONE / EXPIRED / ACTIVE). По умолчанию пользователь = студент (NONE). Проверка статуса подписки — best-effort; при любой ошибке API показываем NONE, не блокируем CTA. Страница /creator/onboarding — инфо, условия, заявка 0₽ (без реального API активации в 5.4).

**Scope**: Только apps/webapp (AccountPage, CreatorOnboardingPage, features/account, shared/queries, MSW). Без изменений API, без .env/dist/debug.

## Definition of Done

- [x] В Mini App вкладка Account всегда открывается (без «вечной ошибки»).
- [x] На Account всегда есть карточка «Стать экспертом» (student default).
- [x] Нажатие CTA → /creator/onboarding без 404.
- [x] На onboarding: инфо/условия, CTA «Подать заявку» (Telegram link или fallback), кнопка «Скопировать текст заявки».
- [x] Нет flicker при переключении табов (refetchOnMount: false, best-effort без error UI).
- [x] pnpm verify PASS, pnpm audit:architecture PASS, pnpm --filter @tracked/webapp test PASS.

## Gates

```bash
pnpm verify
pnpm audit:architecture
pnpm --filter @tracked/webapp test
```

## Ручной тест

1. **Account (3 состояния)**  
   Открыть в dev или Mini App (ngrok):
   - `/account` или `/account?expertCta=none` — карточка «Стать экспертом», CTA «Начать (0₽)».
   - `/account?expertCta=expired` — «Подписка истекла», CTA «Продлить (0₽)».
   - `/account?expertCta=active` — «Вы эксперт», CTA «Открыть кабинет (скоро)».
     Карточка не исчезает и не мигает при переключении табов. При ошибке/отсутствии API показывается состояние NONE (студент), без «Повторить» и без error UI.

2. **Onboarding**  
   Нажать любую CTA «Стать экспертом» → переход на `/creator/onboarding`. На странице: блок статуса (Вы студент / Подписка истекла / Вы эксперт), «Что получите», «Что нужно для старта», «Подписка 0₽», кнопки «Подать заявку / Активировать 0₽» (открывает SUPPORT_LINK) и «Я готов, что дальше?» (копирует текст заявки с @username из initDataUnsafe).

## Dev: 3 URL для проверки состояний

| Состояние      | URL                                      |
| -------------- | ---------------------------------------- |
| NONE (студент) | `/account?expertCta=none` или `/account` |
| EXPIRED        | `/account?expertCta=expired`             |
| ACTIVE         | `/account?expertCta=active`              |

В проде отсутствие API не создаёт error UI — всегда NONE (студент) и доступная карточка.

## Файлы

| Item              | Location                                                          |
| ----------------- | ----------------------------------------------------------------- |
| Логика состояния  | apps/webapp/src/features/account/expertCtaState.ts                |
| Unit тест         | apps/webapp/src/features/account/**tests**/expertCtaState.test.ts |
| Карточка          | apps/webapp/src/features/account/BecomeExpertCard.tsx             |
| Хук (best-effort) | apps/webapp/src/shared/queries/useMyExpertSubscription.ts         |
| Account           | apps/webapp/src/pages/AccountPage.tsx                             |
| Onboarding        | apps/webapp/src/pages/CreatorOnboardingPage.tsx                   |
| MSW               | apps/webapp/src/shared/mocks/handlers.ts, inline.ts, fixtures.ts  |

## ngrok: избежать ERR_NGROK_8012

- В Vite зафиксирован порт: `server.port = 5173`, `server.strictPort = true`, `server.host = true`.
- Запускать ngrok на **127.0.0.1:5173** (не localhost:5174), чтобы upstream совпадал с тем, на чём слушает webapp.

Перед запуском ngrok:

```bash
curl -I http://127.0.0.1:5173/
```

Ожидание: 200 или 304. Затем:

```bash
ngrok http 127.0.0.1:5173
```

В `.env`: `TELEGRAM_WEBAPP_URL=https://<твой-ngrok-url>` (без слэша в конце).

## Support link (onboarding)

- В проде задаётся через **VITE_SUPPORT_TG_LINK** (например `https://t.me/your_support`).
- Если переменная не задана: показывается текст «Укажи VITE_SUPPORT_TG_LINK» и кнопка «Скопировать @username для саппорта», чтобы не открывать несуществующего пользователя.

## Что НЕ делали в 5.4

- Не добавляли API «активировать 0₽» (отдельная стори).
- Не добавляли новые роли/гейты.
- Не трогали .env, dist, debug overlay.
