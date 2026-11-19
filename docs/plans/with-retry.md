# План: Общий withRetry для сетевых запросов

> План для агента-исполнителя. Все архитектурные решения ниже зафиксированы
> и обсуждены с автором. Менять их по ходу нельзя — сомнение превращается
> в вопрос, а не в импровизацию. Код в плане не приводится: задачи описывают
> поток данных и ссылки на файлы-образцы.

---

## Зафиксированные решения (менять нельзя)

1. **Один общий `withRetry`**, а не пер-вызовные обертки. Фильтр ошибок:
   ретраятся только сеть (fetch reject / TypeError), таймаут попытки,
   HTTP 5xx и 429. Любой другой 4xx (400/401/403/404/422…) — сразу наверх,
   без ретрая.
2. **2 попытки** (1 ретрай), короткий фиксированный backoff (~400 мс).
   Без экспоненты, без джиттера — микросбои, а не штормы.
3. **Внешний `AbortSignal` никогда не ретраится.** Отмена юзером/размонтирование
   — это не сбой. Таймаут-аборт внутри попытки — ретраится, внешний — нет.
   `withRetry` принимает внешний signal и пробрасывает abort между попытками.
4. **Ретрай живет внутри клиентов, а не в вызывающих сторах/хуках.**
   Ни один caller (сторы, хуки, fire-and-forget либы) не меняется.
5. **Чат-стрим ретраится только до первого токена.** Если стрим уже отдал
   хотя бы одну дельту (`onText` вызывался) — любая ошибка наверх без
   ретрая: тихий повтор продублирует текст. До первой дельты ретраятся
   сеть/таймаут/5xx/429 на начальном `fetch` (POST /chat/completions
   серверной стороны не мутирует — ретрай безопасен).
6. **Мутаций с побочным эффектом на внешних API в проекте нет.** Единственные
   POST — chat completions (см. п.5), embeddings (чистая функция, идемпотентна)
   и probe (read-only проверка). Все три ретраятся по правилам выше.
   Локальные SQLite-записи (`src/lib/db`) — не сеть, вне скоупа.
7. **Классификация ошибок в models-fetcher не меняется.** Фетчеры возвращают
   `FetchModelsResult`, а не бросают — `withRetry` оборачивает сырой `fetch`
   внутри, классификация ответа остается снаружи, на месте.
8. **Документацию не писать и не просить** — отдельный шаг после реализации.

---

## 0. Файлы для изучения (обязательно перед началом)

1. `docs/VISION.md` — концепция (Privacy First / BYOK, нативный fetch без бекенда).
2. `src/lib/ai/openai-compat-client.ts` — чат-клиент: SSE-стрим, `ChatCompletionError`
   со `status` и `partialText`.
3. `src/lib/ai/embeddings/embeddings-client.ts` — Jina-клиент, `embed(texts, signal)`.
4. `src/shared/lib/ai/models-fetcher/fetchers/models-fetcher.ts` — 5 фетчеров,
   у каждого свой таймаут + внешний abort + классификация в результат.
5. `src/features/chats/model/use-chat-actions.ts` — единственный caller чата.
6. `src/features/chats/model/search-store.ts` — caller embeddings с signal.
7. `src/features/chats/lib/update-context-embedding.ts`,
   `src/features/chats/lib/update-title-embedding.ts` — fire-and-forget callers.
8. `src/shared/lib/ai/models-fetcher/store/models-store.ts` — in-flight контроллеры.
9. `src/shared/lib/ai/provider-detect/hooks/use-base-url-validation.ts` — probe с debounce.
10. `tests/README.md` и `tests/api-templates/*.test.ts` — стиль тестов (tsx, без jest-глобалов).

---

## 1. Инвентаризация: все сетевые точки проекта

Полный список — других `fetch`/WebSocket/axios в `src/` нет (проверено grep).

| # | Файл | Функция | Метод | Идемпотентность | Ретрай |
|---|------|---------|-------|-----------------|--------|
| 1 | `src/shared/lib/ai/models-fetcher/fetchers/models-fetcher.ts` | `fetchAvailableModels` | GET /models | да | **да** |
| 2 | там же | `fetchProviderJson` (anthropic/gemini/cohere) | GET /models | да | **да** |
| 3 | там же | `probeChatCompletions` | POST probe | да (read-only проверка) | **да** |
| 4 | `src/lib/ai/embeddings/embeddings-client.ts` | `embed` | POST /embeddings | да (чистая функция) | **да** |
| 5 | `src/lib/ai/openai-compat-client.ts` | `streamChatCompletion` | POST /chat/completions, SSE | да до первого токена | **да, только до первой дельты** |

Не ретраится и не трогается:

- `src/lib/db/*` — локальный SQLite, не сеть.
- `src/features/chats/model/chats-store.ts`, `generation-store.ts` — локальное состояние.
- Стрим после первой дельты (п.5 зафиксированных решений).

---

## 2. Новый модуль `withRetry`

Создать `src/shared/lib/net/` (рядом с `input/`, `search/` — общий слой без домена):

- `src/shared/lib/net/with-retry.types.ts` — типы: опции (`attempts`, `backoffMs`,
  `signal?`, `shouldRetry?`), класс/тип `RetryableError` (несет `status?: number`).
- `src/shared/lib/net/with-retry.config.ts` — `RETRY_ATTEMPTS = 2`,
  `RETRY_BACKOFF_MS = 400`.
- `src/shared/lib/net/with-retry.ts` — реализация + `isRetryableStatus(status)` /
  `isRetryableError(error)` (сеть: fetch reject/`TypeError`; таймаут: abort
  внутренней попытки; статусы: 408, 429, 500–599).
- `src/shared/lib/net/index.ts` — реэкспорт.

Контракт:

- `withRetry(fn, opts)` вызывает `fn(attempt)`; при ретраебельной ошибке и
  `attempt < attempts` ждет `backoffMs` и повторяет; иначе бросает последнюю ошибку.
- Внешний `signal` aborted → бросить немедленно, без ретрая и без backoff
  (проверять и перед сном, и после).
- Дефолтный `shouldRetry` — по п.1; переопределение нужно только чату (п.5).

---

## 3. Задачи

### Задача 1. Модуль `withRetry` + тесты

Создать файлы из раздела 2. Тесты в `tests/net/with-retry.test.ts` в стиле
существующих (`tests/api-templates/`): ретрай на сети/5xx/429/таймауте,
fail-fast на 4xx, отсутствие ретрая при внешнем abort, число вызовов = 2,
backoff соблюден (фейковый таймер или маленький backoff в тесте).

### Задача 2. models-fetcher: ретрай GET и probe

Файл: `src/shared/lib/ai/models-fetcher/fetchers/models-fetcher.ts`.

- В `fetchAvailableModels`, `fetchProviderJson` и `probeChatCompletions`
  обернуть сырой `fetch` (+ проверку статуса) в `withRetry`, передав внешний
  `signal`. Существующий внутренний таймаут-контроллер остается на попытку —
  таймаут одной попытки ретраится, внешний abort — нет.
- 401/403 по-прежнему классифицируются в `unauthorized` без ретрая (это 4xx).
- Классификация `network`/`other` и парсинг — без изменений, снаружи обертки.
- `fetchAnthropicModels`/`fetchGeminiModels`/`fetchCohereModels` менять не нужно —
  они идут через `fetchProviderJson`.

Проверка: `models-store.ensureModels` и `use-base-url-validation` не меняются —
in-flight контроллеры и debounce работают как раньше, т.к. ретрай завершается
до возврата результата.

### Задача 3. Embeddings: ретрай идемпотентного POST

Файл: `src/lib/ai/embeddings/embeddings-client.ts`.

- Обернуть `fetch` внутри `embed` в `withRetry` с внешним `signal`.
- Ошибки 4xx (невалидный ключ и т.п.) — наверх сразу, как сейчас.
- Callers (`update-context-embedding.ts`, `update-title-embedding.ts`,
  `search-store.ts`) не меняются: fire-and-forget тихо деградирует как раньше,
  search по-прежнему не ломает keyword-поиск.

### Задача 4. Чат: ретрай только до первого токена

Файлы: `src/lib/ai/openai-compat-client.ts` (основной),
`src/features/chats/model/use-chat-actions.ts` (только проброс флага, см. ниже).

- В `streamChatCompletion` отслеживать, был ли уже вызван `onText`
  (локальный флаг `emitted`).
- Начальный `fetch` + проверка `response.ok` + первое чтение из стрима:
  при ошибке сети/таймаута/5xx/429 и `!emitted` — один ретрай через `withRetry`.
  Проще всего: обернуть в `withRetry` шаг «fetch + ok-проверка», а `emitted`
  проверять через кастомный `shouldRetry` (замыкание над флагом).
- Ошибка посреди стрима (после первой дельты) — наверх без ретрая,
  `partialText` сохраняется как сейчас.
- `ChatCompletionError` с 4xx — наверх сразу (fail-fast, честная ошибка юзеру).
- Внешний abort (юзер ушел из чата / отмена) — без ретрая.
- `use-chat-actions.ts` меняется минимально или не меняется вовсе: контракт
  `streamChatCompletion` тот же. Если для флага нужен колбэк-обертка — менять
  только внутри клиента.

### Задача 5. Прогон и проверка

- `npx tsc --noEmit` (или скрипт проекта, если есть).
- Тесты: `npx tsx tests/net/with-retry.test.ts` + существующие тесты
  `tests/api-templates/` — ничего не сломалось.
- Ручная проверка в приложении: чат с невалидным ключом показывает ошибку
  сразу (без 400 мс задержки), чат с таймаутом ретраится один раз до первого
  токена, список моделей переживает один сбой сети.

---

## 4. Явно вне скоупа

- Экспоненциальный backoff, джиттер, Retry-After из 429 — не делаем (п.2).
- Ретрай мутаций с idempotency key — в проекте нет таких внешних эндпоинтов;
  если появятся, ключ + ретрай добавлять по этому же плану (новая задача).
- Очереди/отложенные повторы fire-and-forget эмбеддингов — тихая деградация
  остается как есть.
