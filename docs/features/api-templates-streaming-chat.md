---

**Дата:** 18.10.2026
**Теги:** #features #api-templates #streaming #sse #chat #securestore

---

## 1. Зачем

Чат не умел разговаривать: сообщения отправлять было некуда — не было ни
провайдеров, ни ключей, ни самого запроса к API. Таблица `messages` была
создана «на вырост» и не использовалась. Задача — дать пользователю
возможность подключить свой OpenAI-совместимый API (OpenAI, OpenRouter),
привязать его к чату и получать стриминговые ответы токен-за-токеном,
с сохранением всей истории переписки в локальной БД.

Заодно модель хранения сообщений переведена на пару `context`/`notes`:
одна строка `context` = один контекст чата, записи переписки живут в
`notes` с ролью автора. Это развязывает «контекст чата» (нужен поиску)
и «сообщения» (нужны чату и API).

## 2. Где/что уже было

Переиспользовано без переписывания:

- **`openDb()` + миграционный механизм** (`src/lib/db/migrations.ts`) —
  новая миграция v4 добавлена в существующий switch по `PRAGMA user_version`.
- **FTS-триггеры `chats_au`** из фичи поиска — обновление `chats.context`
  автоматически переиндексирует FTS5, репозиторий об этом не знает.
- **`updateChatEmbedding` + `getEmbeddingsClient`** из фичи поиска —
  эмбеддинг контекста пишется тем же механизмом, что и title_embedding.
- **`PopoverMenu` / `usePopoverAnchor`** (`src/shared/components/ui/PopoverMenu`)
  — поповер выбора шаблона собран из готового UI-компонента.
- **`showToast` / `useT`** — тосты и i18n (ru/en) по существующему паттерну.
- **Паттерн «репозиторий → zustand-стор → хук → UI»** — скопирован с
  chats-store/search-store, новый код вписан в ту же архитектуру FSD.

Задача была не придумывать новые механизмы, а собрать фичу из уже
готовых слоёв: новым оказался только SSE-клиент и сам флоу отправки.

## 3. Реализация

### 3.1 Миграция v4 (migrations.ts, DB_SCHEMA_VERSION = 4)

```ts
// src/lib/db/migrations.ts
// v4: context/notes вместо messages, api_templates, chats.template_id
if (current < 4) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS context (
      id TEXT PRIMARY KEY NOT NULL,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      context_id TEXT NOT NULL REFERENCES context(id) ON DELETE CASCADE,
      role TEXT NOT NULL,          -- 'user' | 'assistant'
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    DROP TABLE IF EXISTS messages;  -- dev, данных в ней не было
    CREATE TABLE IF NOT EXISTS api_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,     -- дубликат имени = отказ вставки
      provider TEXT NOT NULL,        -- 'openai' | 'openrouter'
      base_url TEXT NOT NULL,        -- из пресета, не вводится вручную
      model TEXT NOT NULL,
      key_ref TEXT NOT NULL,         -- ссылка на ключ в SecureStore
      created_at INTEGER NOT NULL
    );
  `);
  // chats.template_id добавляется через PRAGMA table_info + ALTER
  // (идемпотентно, как в предыдущих миграциях)
}
```

Каскадные FK: удаление чата → удаление его `context` → удаление всех
`notes`. Отдельной чистки не нужно.

### 3.2 Репозиторий шаблонов (ключ — в SecureStore, не в БД)

```ts
// src/lib/db/templates-repository.ts
const KEY_PREFIX = 'template-key-';

// createTemplate(name, provider, model, apiKey) → ApiTemplate
//   ключ → SecureStore.setItemAsync(`template-key-<id>`, apiKey)
//   в БД пишется только key_ref; при ошибке INSERT (дубликат имени)
//   ключ из SecureStore удаляется — мусора не остается
// deleteTemplate(id) → DELETE + SecureStore.deleteItemAsync(key_ref)
// getTemplateKey(id) → string | null
//   читает key_ref из БД, ключ — из SecureStore. Вызывается ТОЛЬКО
//   в момент отправки, в сторах не кэшируется
// getTemplateForChat(chatId) → ApiTemplate | null
//   JOIN chats → api_templates через chats.template_id
```

`baseUrl` не хранится в форме — берется из пресета провайдера:

```ts
// src/types/api-template.ts
export const API_TEMPLATE_PRESETS = {
  openai:     { id: 'openai',     baseUrl: 'https://api.openai.com/v1' },
  openrouter: { id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' },
};
```

### 3.3 Репозиторий контекста (context/notes)

```ts
// src/lib/db/context-repository.ts
// ensureContext(chatId) → contextId
//   находит контекст чата или создает строку в context
// appendNote(chatId, role, text) → NoteRecord
//   ensureContext + INSERT в notes; возвращает готовую запись —
//   она же сразу уходит в UI (appendLocalNote)
// getNotes(chatId) → NoteRecord[]
//   JOIN notes → context WHERE chat_id, ORDER BY created_at ASC,
//   rowid ASC (тай-брейк для записей в одну миллисекунду).
//   Это И контекст для запроса к API, И история для loadChat
// appendToChatContext(chatId, text)
//   UPDATE chats SET context = context || ' ' + text —
//   триггер chats_au сам переиндексирует FTS
```

### 3.4 SSE-клиент (ручной парсинг потока)

```ts
// src/lib/ai/openai-compat-client.ts
export async function streamChatCompletion(
  config: ChatCompletionConfig,          // { baseUrl, apiKey, model, messages }
  onText: (accumulatedText: string) => void,
  signal?: AbortSignal,
): Promise<string>                      // полный текст ответа
```

Как работает:

- `fetch` из `expo/fetch` (нативный стриминг в RN, не полифил) →
  `POST {baseUrl}/chat/completions`, `stream: true`.
- Не `ok` → тело парсится `chatCompletionErrorSchema`, из него достается
  `error.message`; бросается `ChatCompletionError { status, message, partialText }`.
- `response.body.getReader()` + `TextDecoder` → буфер строк режется на
  полные строки (`parseSseDataLines`), неполный хвост остается в буфере.
- Формат OpenAI: `data: <json>`, завершение — `data: [DONE]`.
- Каждый payload: `JSON.parse` → `chatCompletionChunkSchema.safeParse`
  (невалидные чанки молча пропускаются) → `choices[].delta.content`
  дописывается в `accumulated`, колбэк получает **накопленный** текст.
- Возвращает полный текст — он и пишется в notes.

### 3.5 Zod-схемы

```ts
// src/schemas/api-template.ts
apiTemplateFormSchema      // форма: name/provider/model/apiKey, все trim().min(1)
chatCompletionChunkSchema  // { choices: [{ delta: { content? }, finish_reason? }] }
chatCompletionErrorSchema  // { error?: { message? } } — тело ошибки API
```

### 3.6 Флоу отправки (use-chat-actions.ts) — главная функция

```ts
// src/features/chats/model/use-chat-actions.ts
sendMessage(chatId: string | null, text: string): Promise<void>
```

Пошагово:

1. `trim` пустой → выход; `status === 'streaming'` → выход (повторная
   отправка во время стрима заблокирована).
2. Определение шаблона: для существующего чата — `chats[].templateId`,
   для временного — `tempTemplateId`. Нет шаблона → тост, выход.
3. `getTemplate(id)` → нет → тост; `getTemplateKey(id)` → нет ключа → тост.
4. `chatId === null` → `initTempChat(title-заглушка, templateId)`:
   чат создается в БД **до запроса**, становится активным, попадает в
   список. Черновик временного чата очищается. Если запрос упадет —
   чат уже существует, сообщение юзера в нем сохранено.
5. `appendNote(chatId, 'user', text)` → в БД; если чат активен —
   `appendLocalNote` (сразу в UI, без перезагрузки).
6. `getNotes(chatId)` → вся история по возрастанию → `messages`
   (`role`/`content` как есть, system-сообщений нет).
7. `generationStore.start(chatId)` → `streamChatCompletion(...)`,
   каждый колбэк → `appendChunk(accumulated)` → UI растет токен-за-токеном.
8. Успех: `appendNote(chatId, 'assistant', fullText)` → БД + UI,
   `generationStore.finish()`, fire-and-forget
   `updateChatContextData(chatId, "userText assistantText")`.
9. Ошибка: **ничего не пишется** в notes/context/эмбеддинги.
   `generationStore.fail(message)` — временное системное сообщение
   в чате (в БД не попадает) + тост.

```ts
// src/features/chats/lib/update-context-embedding.ts
// updateChatContextData(chatId, text): fire-and-forget
//   1) appendToChatContext → chats.context (FTS обновится триггером)
//   2) getEmbeddingsClient() → нет ключа → тихий выход
//      client.embed([text]) → updateChatEmbedding(chatId, 'context', vector)
//   Любая ошибка тихо пропускается — поиск догонит на следующей итерации
```

### 3.7 Сторы

```ts
// src/features/api-templates/model/templates-store.ts
// templates, isLoading; loadTemplates / addTemplate / deleteTemplate

// src/features/chats/model/generation-store.ts (slim-стор)
// status: 'idle' | 'streaming' | 'error'
// chatId: string | null   — чат, которому принадлежит стрим/ошибка
// streamingText, errorText
// start(chatId) / appendChunk(accumulated) / finish() / fail(msg) / reset()
```

Расширение `chats-store`:

```ts
// src/features/chats/model/chats-store.ts
// activeNotes: NoteRecord[]      — контекст активного чата
// activeTemplate: ApiTemplate | null — шаблон активного чата
// tempTemplateId: string | null  — выбор шаблона ДО создания чата
// lastTemplateId: string | null  — глобальный «последний используемый»
//   шаблон: обновляется СРАЗУ при выборе в поповере, персистится
//   в SecureStore (ключ 'last-template-id', src/features/chats/lib/
//   last-template.ts) и переживает рестарт. Временный чат всегда
//   стартует с этим шаблоном (setActiveChat(null) и clearLoadedChat
//   подставляют его в tempTemplateId)
// loadChatToken: number          — защита от гонок загрузки
//
// loadChat(chatId) — инкрементит токен, параллельно тянет
//   getNotes + getTemplateForChat; применяется только если
//   activeChatId и токен не изменились (ранняя загрузка не
//   перетирает notes, дописанные после нее)
// setChatTemplate(chatId, templateId) — БД + chats[] + activeTemplate
//   + обновление lastTemplateId (персист сразу, без ожидания отправки)
// setTempTemplate(id) — выбор для временного чата + обновление
//   lastTemplateId (персист сразу)
// initTempChat(title, templateId) — createChat в БД, чат в список,
//   становится активным, tempTemplateId сбрасывается, globalDraft очищается
// appendLocalNote(note) — push в activeNotes
// clearLoadedChat() — сброс при уходе во временный чат,
//   tempTemplateId = lastTemplateId
// deleteChat — теперь еще чистит activeNotes/activeTemplate удаленного чата
```

Не тронуто: механизм миграций, FTS-триггеры, embeddings-клиент,
сайдбар, поиск, черновики — вся логика поиска и списка чатов работает
как раньше.

## 4. UI

**Вкладка API** (`src/app/(tabs)/api.tsx`) — форма создания шаблона
(имя, переключатель пресета OpenAI/OpenRouter, модель вручную, ключ со
`secureTextEntry`) + список шаблонов с удалением. Валидация формы —
`apiTemplateFormSchema.safeParse`, ошибка — тост; `UNIQUE(name)` ловится
как `apiTab.duplicateName`.

**Выбор шаблона в чате** (`ChatInputArea.tsx`) — мини-кнопка с иконкой
ключа слева от инпута открывает `PopoverMenu` со списком шаблонов
(имя + модель, галочка у выбранного). Для существующего чата выбор идет
в `setChatTemplate` (БД + стор), для временного — в `setTempTemplate`
(только стор, переедет в чат при первой отправке).

Без шаблона: инпут `editable={false}` с плейсхолдером-подсказкой,
у кнопки отправки нейтральный плюсик. С шаблоном: закрашенный кружок
(акцент при `canSend`), отправка активна при непустом черновике и
не идущем стриме.

**Список сообщений** (`ChatMessages.tsx`, встроен в `ChatContent`
вместо TODO-заглушки) — `ScrollView` с пузырями: user справа на акценте,
assistant слева на карточке. Стриминговое сообщение — растущий текст с
курсором `▍`. Ошибка — серая строка по центру (не пузырь, в БД не пишется).
Автопрокрутка вниз на каждое изменение.

## 5. Поток данных

Отправка сообщения (временный чат):

```
Клик по кнопке отправки (canSend)
↓ sendMessage(null, draft)
↓ getTemplate(tempTemplateId) → getTemplateKey → SecureStore
↓ initTempChat(title, templateId) → createChat в БД → chats-store
↓ appendNote(chatId, 'user', text) → БД + appendLocalNote → UI
↓ getNotes(chatId) → messages[] (вся история по возрастанию)
↓ generationStore.start(chatId)
↓ streamChatCompletion(config, onText)
↓   fetch POST {baseUrl}/chat/completions (stream: true)
↓   reader.read() → TextDecoder → parseSseDataLines → zod → delta.content
↓   onText(accumulated) → generationStore.appendChunk → ChatMessages (▍)
↓ [DONE] → appendNote(chatId, 'assistant', fullText) → БД + UI
↓ generationStore.finish()
↓ updateChatContextData(chatId, "user assistant") — fire-and-forget
↓   appendToChatContext → chats.context → FTS-триггер chats_au
↓   embeddings-client → updateChatEmbedding(chatId, 'context', vector)
```

Ошибка на любом шаге запроса:

```
ChatCompletionError / network
↓ generationStore.fail(message) → серая строка в чате (не в БД)
↓ showToast(message)
↓ notes/context/эмбеддинги не тронуты — повторная отправка чистая
```

Открытие существующего чата:

```
Клик по чату в сайдбаре
↓ setActiveChat(id)
↓ ChatMessages.useEffect: generation.chatId !== activeChatId → reset()
↓ loadChat(chatId) → loadChatToken++
↓   Promise.all([getNotes(chatId), getTemplateForChat(chatId)])
↓   activeChatId и токен не изменились → activeNotes + activeTemplate
↓ ChatInputArea: selectedTemplate = activeTemplate → инпут разблокирован
```

Создание шаблона:

```
Вкладка API → заполнение формы → «Добавить»
↓ apiTemplateFormSchema.safeParse → ошибка → тост
↓ addTemplate → createTemplate
↓   SecureStore.setItemAsync('template-key-<id>', apiKey)
↓   INSERT INTO api_templates (key_ref = 'template-key-<id>')
↓   ошибка INSERT → deleteItemAsync(key_ref) → тост duplicateName
↓ templates-store: templates + template → список обновился
```

## 6. Почему так, а не иначе

1. **Ключ в SecureStore, в БД только `key_ref`** — SQLite-файл может
   попасть в бэкапы/шаринг, SecureStore — ключевой цепочка ОС. Чтение
   ключа только в момент отправки: ключ не живет в памяти сторов.
2. **Ручной SSE-парсинг вместо библиотеки** — `expo/fetch` дает нативный
   стриминг, протокол OpenAI SSE тривиален (`data:` / `[DONE]`); zod на
   чанках дает устойчивость к мусору в потоке без зависимости на SDK.
3. **Временный чат создается до запроса, а не после** — если запрос упадет,
   черновик и сообщение юзера не теряются: чат уже в списке и в БД.
   Альтернатива (создавать после успешного ответа) теряла бы текст.
4. **Ошибка — временное сообщение в сторе, а не запись в notes** —
   неудавшийся запрос не должен попадать в контекст, который уйдет в
   следующий запрос к API. `generation.chatId` гарантирует, что стрим/
   ошибка не показываются в другом чате после переключения.
5. **`context`/`notes` вместо возврата к `messages`** — поиск уже построен
   вокруг `chats.context` (FTS + embedding); notes дают историю для API,
   context — денормализованную сводку для поиска, обе сущности каскадно
   чистятся вместе с чатом.

## Преимущества

- ✅ Ключи API не хранятся в БД — только в SecureStore, читаются в момент отправки
- ✅ Стриминг токен-за-токеном на нативном `expo/fetch`, без внешних SDK
- ✅ Валидация чанков и ошибок API zod-схемами — мусорный поток не роняет UI
- ✅ Ошибка запроса не загрязняет историю: notes/context/эмбеддинги чистые
- ✅ Временный чат создается до запроса — текст не теряется при сбое
- ✅ История чата = notes: и контекст для API, и открытие старого чата одним механизмом
- ✅ Гонки загрузки контекста устранены токеном loadChatToken
- ✅ FTS и эмбеддинг поиска обновляются существующими механизмами, без нового кода
