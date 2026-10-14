---

**Дата:** 14.10.2026
**Теги:** #features #chats #search #fts5 #sqlite-vec #embeddings

---

## 1. Зачем

Сайдбар чатов нуждался в рабочем поиске по истории: пользователь должен находить чат по названию даже тогда, когда не помнит его точную формулировку («пролистал», «просмотрел», «где мы обсуждали миграции»). Точный keyword-поиск покрывает первое, семантический (embedding) — второе. Решение — гибрид из двух независимых этапов, работающих поверх локальной SQLite.

## 2. Архитектура

Поиск — это два независимых конвейера, сливающихся на уровне UI-стора:

```
Ввод пользователя
  ├── (немедленно) FTS5 keyword-поиск ──── локальная SQLite, без сети
  └── (дебаунс 500мс) embedding-поиск ─── OpenRouter → sqlite-vec KNN
                       ↓
        mergeSearchResults() → единый список в сайдбаре
```

Слои и их ответственность:

```
src/lib/db/
  migrations.ts            — схема v3: колонки chats, chats_fts (FTS5), chats_vec (vec0)
  search.config.ts         — константы слоя (маркеры подсветки, лимиты)
  search-repository.ts     — SQL: keyword-поиск, KNN-поиск, запись/удаление эмбедингов
  chats-repository.ts      — CRUD чатов (deleteChat вызывает deleteChatEmbeddings)

src/lib/ai/embeddings/
  embeddings.config.ts     — модель, размерность, порог similarity, base URL
  embeddings-client.ts     — OpenAI-совместимый fetch-клиент POST /embeddings
  index.ts                 — публичные экспорты слоя

src/features/chats/
  model/search-store.ts    — zustand-стор: стейт поиска + вызовы репозитория
  model/use-chat-search.ts — хук: дебаунс, отмена, точка входа для UI
  lib/merge-search-results.ts   — слияние результатов двух этапов
  lib/highlighted-title.ts      — разбор подсветки FTS5 в диапазоны
  lib/update-title-embedding.ts — перегенерация title_embedding

src/app/(tabs)/chat/components/ChatSidebar/
  ChatSidebar.tsx          — UI: поисковый ввод + FlatList результатов
```

## 3. Реализация

### 3.1 Схема (миграция v3, migrations.ts)

Миграция идемпотентна (проверка `PRAGMA table_info` перед каждым ALTER) и состоит из трёх частей:

**Колонки в `chats`:** `context` (сводка чата для поиска, пока пустая), `title_embedding` и `context_embedding` (JSON-текст вектора — источник истины).

**FTS5-таблица** — обычная (не external-content), потому что у `chats` нет rowid-совместимого PRIMARY KEY:

```sql
CREATE VIRTUAL TABLE chats_fts USING fts5(
  chat_id UNINDEXED,   -- UNINDEXED: участвует в JOIN, не в поиске
  title,
  context
);
```

Актуальность индекса поддерживают три триггера на `chats`:
- `chats_ai` (AFTER INSERT) — вставляет строку в `chats_fts`;
- `chats_ad` (AFTER DELETE) — удаляет;
- `chats_au` (AFTER UPDATE OF title, context) — DELETE + INSERT.

Любой `UPDATE chats SET title = ...` (например, `renameChat`) переиндексируется автоматически на уровне SQLite — репозиторию про FTS знать не нужно. Плюс backfill на старте: чаты, отсутствующие в `chats_fts`, досинхронизируются.

**Векторная таблица** — sqlite-vec, две колонки векторов в одной строке:

```sql
CREATE VIRTUAL TABLE chats_vec USING vec0(
  chat_id TEXT PRIMARY KEY,
  title_embedding float[4096],
  context_embedding float[4096]
);
```

vec0 триггеров не поддерживает — синхронизация делается вручную в репозитории. Создание обёрнуто в try/catch: на web без расширения таблица просто не создаётся, keyword-поиск продолжает работать.

### 3.2 Ключевые функции

**`searchChatsByKeywords(query)`** — keyword-этап (search-repository.ts):
- Принимает: строку запроса
- Возвращает: `ChatKeywordSearchRecord[]` — чат + `highlightedTitle` с маркерами
- Совпадения в title идут первыми, далее bm25; подсветка через `highlight()`

```ts
const rows = await db.getAllAsync<ChatKeywordSearchRow>(
  `SELECT c.id, c.title, ..., highlight(chats_fts, 1, ?, ?) AS highlighted_title
   FROM chats_fts
   JOIN chats c ON c.id = chats_fts.chat_id
   WHERE chats_fts MATCH ?
   ORDER BY
     CASE WHEN instr(highlighted_title, ?) > 0 THEN 0 ELSE 1 END,
     bm25(chats_fts)
   LIMIT ?`,
  [FTS_HIGHLIGHT_START, FTS_HIGHLIGHT_END, buildFtsMatchQuery(trimmed),
   FTS_HIGHLIGHT_START, KEYWORD_SEARCH_LIMIT],
);
```

**`buildFtsMatchQuery(query)`** — сборка MATCH-запроса:
- Каждый токен — quoted-фраза (внутренние кавычки удваиваются), спецсимволы FTS-синтаксиса безопасны.
- Токены от 3 символов получают префиксный поиск: `"пролист"*` найдёт «пролистал», «пролистать». Токенизатор по умолчанию (unicode61) не делает стемминга, префикс компенсирует это для русского. Токены 1–2 символов ищутся точно — префикс из пары букв даёт слишком много шума.

```ts
const PREFIX_SEARCH_MIN_LENGTH = 3;

function buildFtsMatchQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const quoted = `"${token.replace(/"/g, '""')}"`;
      return token.length >= PREFIX_SEARCH_MIN_LENGTH ? `${quoted}*` : quoted;
    })
    .join(' ');
}
```

**`searchChatsByEmbedding(vector)`** — семантический этап:
- Принимает: вектор запроса
- Возвращает: `ChatEmbeddingSearchRecord[]` — чат + cosine similarity
- Ищет по обеим колонкам (`title_embedding`, `context_embedding`), для чата, найденного обеими, берёт лучшую similarity; фильтр по порогу `SIMILARITY_THRESHOLD = 0.75`; отсутствие таблицы (web) — корректный пустой результат.

**`updateChatEmbedding(chatId, kind, vector)`** — запись эмбединга:
- Пишет вектор в колонку `chats` (JSON) и синхронизирует строку `chats_vec` целиком (DELETE + INSERT в транзакции), читая оба вектора из `chats` — vec0 не принимает частичные вставки.
- `UPDATE ... WHERE id = ?` заодно проверяет существование чата: если чат удалили, пока запрос эмбединга был в полёте, писать некуда (`result.changes === 0` → выход).

**`getEmbeddingsClient()`** (embeddings-client.ts):
- Возвращает клиент или `null`, если `EXPO_PUBLIC_OPENROUTER_API_KEY` не задан — embedding-этап тихо пропускается, keyword-поиск от него не зависит.
- Чистый fetch поверх OpenAI-совместимого `POST /embeddings`, поддержка `AbortSignal`, ответ валидируется zod-схемой.

**`updateTitleEmbedding(chatId, title)`** — перегенерация title-эмбединга:
- Fire-and-forget: отсутствие ключа или ошибка сети тихо пропускаются, колонка остаётся NULL/старой до следующей попытки.
- Вызывается ровно в двух точках изменения title: создание чата (`use-create-chat.ts`) и переименование (`use-chat-actions.ts`).

**`useChatSearch()`** — единственная точка входа UI в поиск (use-chat-search.ts):
- Принимает: ничего; Возвращает: `{ query, results, isSearching, handleChangeText, resetSearch }`
- Keyword-поиск — немедленно на каждый ввод (локальный FTS дешёв); embedding — с дебаунсом `EMBEDDING_SEARCH_DEBOUNCE_MS`, каждый новый ввод сбрасывает таймер и прерывает предыдущий запрос через `AbortController`.

```ts
const handleChangeText = useCallback((text: string) => {
  cancelPendingEmbeddingSearch();

  if (text.trim() === '') {
    clearSearch();
    return;
  }

  void searchByKeywords(text);

  debounceRef.current = setTimeout(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    void searchByEmbeddings(text, controller.signal);
  }, EMBEDDING_SEARCH_DEBOUNCE_MS);
}, [...]);
```

**`useSearchStore`** (zustand) — стейт и вызовы репозитория:
- `searchByKeywords` маппит записи в `ChatSearchResult` (sources: `['keyword']`, диапазоны подсветки через `parseHighlightedTitle`).
- `searchByEmbeddings` маппит similarity в `score` (sources: `['embedding']`).
- Защита от гонок: результат пишется в стейт только если `state.query === query` — устаревший ответ не затирает свежий.
- Таймеры и отмена живут в хуке, не в сторе — стор остаётся чистым.

**`mergeSearchResults(keyword, embedding)`** — слияние:
- Dedupe по id чата; у чата, найденного обоими этапами, объединяются `sources`, приоритет у keyword-результата (сохраняется подсветка).
- Keyword-результаты сохраняют порядок релевантности, embedding-only добавляются после.

**`parseHighlightedTitle` / `splitTitleByRanges`** — подсветка:
- FTS5 `highlight()` оборачивает совпадения маркерами `\u0001...\u0002` (константы из search.config.ts используются и в SQL, и в парсере).
- Парсер переводит маркеры в диапазоны `{ start, end }` (индексы по code units), `splitTitleByRanges` режет title на сегменты «совпало / не совпало» для рендера.

### 3.3 Константы

```ts
// search.config.ts
FTS_HIGHLIGHT_START = '\u0001'   // маркер начала совпадения highlight()
FTS_HIGHLIGHT_END = '\u0002'     // маркер конца совпадения
KEYWORD_SEARCH_LIMIT = 50        // максимум keyword-результатов
EMBEDDING_SEARCH_LIMIT = 50      // максимум KNN-кандидатов

// embeddings.config.ts
EMBEDDING_MODEL = 'nvidia/nemotron-3-embed-1b:free'
EMBEDDING_DIMENSIONS = 4096      // размерность; используется миграцией v3
SIMILARITY_THRESHOLD = 0.75      // порог cosine similarity
EMBEDDINGS_BASE_URL = 'https://openrouter.ai/api/v1'

// use-chat-search.config.ts
EMBEDDING_SEARCH_DEBOUNCE_MS = 500
```

## 4. Поток данных

**Поиск (каждый ввод):**
```
TextInput onChangeText
  ↓
useChatSearch.handleChangeText(text)
  ├── searchByKeywords(text) ── немедленно
  │     searchChatsByKeywords → FTS5 MATCH + highlight()
  │     → parseHighlightedTitle → keywordResults (sources: ['keyword'])
  └── через 500мс дебаунса: searchByEmbeddings(text, signal)
        getEmbeddingsClient() → null? → тихий выход (нет ключа)
        client.embed([query], signal) → OpenRouter /embeddings
        searchChatsByEmbedding(vector) → chats_vec KNN, порог 0.75
        → embeddingResults (sources: ['embedding'], score: similarity)
  ↓
mergeSearchResults(keywordResults, embeddingResults) — useMemo
  ↓
ChatSidebar FlatList: data={results}, подсветка через splitTitleByRanges
```

**Запись эмбединга (title):**
```
Создание чата (use-create-chat) / rename (use-chat-actions)
  ↓
void updateTitleEmbedding(chat.id, title)   // fire-and-forget
  ↓
getEmbeddingsClient() → client.embed([title]) → OpenRouter
  ↓
updateChatEmbedding(chatId, 'title', vector)
  ├── UPDATE chats SET title_embedding = ? (JSON)
  └── транзакция: DELETE chats_vec + INSERT (оба вектора, NULL пропускается)
```

**Удаление чата:**
```
deleteChat (chats-repository) → chats удаляется
  → триггер chats_ad чистит chats_fts автоматически
  → deleteChatEmbeddings(chatId) чистит chats_vec вручную
```

**Закрытие панели:** `if (!isOpen) resetSearch()` — отмена таймеров/запросов + очистка стейта.

## 5. Почему так, а не иначе

1. **Гибрид вместо одного механизма.** FTS5 даёт точный матчинг и подсветку, но unicode61 не умеет стемминг — «пролистал» не найдётся по «пролистать». Эмбединг закрывает морфологию и перефразировки, но слаб на редких токенах (имена, ID, названия библиотек) и коротких запросах. Префиксный поиск (`"токен"*`) закрывает дыру точного матчинга по началу слова. Каждый механизм компенсирует слабости остальных.

2. **Разные режимы для этапов: keyword немедленно, embedding с дебаунсом.** FTS — локальный запрос за миллисекунды, гонять его на каждый ввод дёшево и даёт мгновенную обратную связь. Embedding — сетевой запрос: без дебаунса и отмены он бы генерировал очередь устаревающих запросов и расходовал лимиты.

3. **Обычная FTS5-таблица, а не external-content.** У `chats` нет `INTEGER PRIMARY KEY` (id — TEXT/UUID), external-content таблица требует rowid-совместимости. Обычная таблица + триггеры — стандартный паттерн FTS5 для такого случая; цена — дублирование данных, для заголовков несущественное.

4. **Ручная синхронизация chats_vec вместо попытки автоматизации.** vec0 не поддерживает триггеры в принципе — альтернативы нет. Синхронизация инкапсулирована в `updateChatEmbedding`/`deleteChatEmbeddings`, вызывающий код о ней не знает.

5. **JSON-вектор в chats + вектор в chats_vec.** `chats` — источник истины; перед записью в vec0 оба вектора перечитываются из `chats`, и строка vec0 пишется целиком. Это устраняет рассинхрон между колонками и обходит ненадёжность частичных вставок vec0.

6. **Тихая деградация на каждом уровне.** Нет ключа → embedding-этап пропускается; нет sqlite-vec (web) → таблица не создаётся, KNN возвращает пусто; ошибка сети → keyword-результаты не трогаются. Поиск никогда не падает целиком из-за отказа одного этапа.

7. **Защита от гонок через сравнение query.** Вместо отмены каждого запроса (для keyword-этапа отмена не нужна — он синхронно-локальный) результат применяется только если запрос ещё актуален. Для embedding-этапа — обе защиты: AbortController + проверка query.

8. **Маркеры подсветки `\u0001/\u0002`, а не HTML-теги.** FTS5 `highlight()` принимает любые строки; управляющие символы не встречаются в пользовательском тексте, парсер диапазонов остаётся тривиальным, а рендер не вставляет сырой HTML.

## 6. Текущие ограничения

- **context не заполняется:** колонка `context` и оба `*_embedding` для контента созданы, но точек записи нет — векторный поиск фактически работает только по title. Запросы написаны так, что заработают сами, когда появится отправка сообщений.
- **EMBEDDING_DIMENSIONS = 4096** зафиксирован до первого реального вызова модели — при несовпадении таблицу `chats_vec` нужно пересоздать миграцией.
- **Стемминга русского нет** (ограничение expo-sqlite: кастомные токенизаторы FTS5 из JS не подключаются) — морфологию закрывают префиксный поиск и эмбединг.

## Преимущества

- ✅ Гибридный поиск: точный (FTS5 + префиксы) и семантический (sqlite-vec) этапы, дополняющие друг друга
- ✅ Мгновенная обратная связь: keyword-результаты на каждый ввод, подсветка совпадений в title
- ✅ Отказоустойчивость: тихая деградация каждого этапа, keyword-поиск не зависит ни от сети, ни от ключа
- ✅ Актуальность индексов: FTS — триггерами SQLite, vec0 — инкапсулированной ручной синхронизацией
- ✅ Защита от гонок: AbortController + проверка актуальности query перед записью в стейт
- ✅ Чистое разделение слоёв: SQL в репозитории, сеть в embeddings-клиенте, оркестрация в сторе, таймеры в хуке
- ✅ Типобезопасность: zod-валидация ответа эмбедингов, типизированные строки/результаты
