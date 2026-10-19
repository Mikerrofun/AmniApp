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

Пошагово (оптимистичный UI: notes пишем только после успешного стрима):

1. `trim` пустой → выход; `status === 'streaming'` или
   `pendingUserText !== null` → выход (повторная отправка заблокирована).
2. **Оптимистичное сообщение юзера** — `generationStore.setPendingUser(text)`:
   пузырь в UI мгновенно, до всех проверок. Черновик очищается.
3. Определение шаблона: для существующего чата — `chats[].templateId`,
   для временного — `lastTemplateId`. `getTemplate(id)`,
   `getTemplateKey(id)`. Любая неудача → `rollbackUi()`: оптимистичный
   пузырь убирается, текст возвращается в инпут, тост.
4. `setLastTemplateId(templateId)` — шаблон использован, запоминаем
   независимо от исхода запроса.
5. Временный чат (`chatId === null`) → `initTempChat(title, templateId)`:
   создается в БД **сразу при отправке** (после валидации), попадает
   в список; активируется только если юзер все еще во временном чате.
   Вернуться к нему можно как к любому обычному чату.
6. История для запроса: `getNotes(chatId)` + новое сообщение **из
   памяти** (в БД оно попадет только после успеха).
7. `generationStore.start(chatId)` → `streamChatCompletion(...)`,
   каждый колбэк → `appendChunk(accumulated)`. Стрим переживает
   переключение чатов: UI гейтится `chatId === activeChatId`,
   сброса генерации при уходе нет.
8. Успех: `appendNote(user)` + `appendNote(assistant)` → БД (атомарно:
   если assistant не записался, user откатывается через `deleteNote` —
   в БД не бывает сообщения без ответа) + `appendLocalNote` в UI
   (если чат активен), `generationStore.finish()`, fire-and-forget
   `updateChatContextData(chatId, "userText assistantText")`.
9. Ошибка: **ничего не пишется** в notes/context/эмбеддинги.
   `generationStore.fail(message)` — оптимистичный пузырь откатывается,
   серая строка ошибки в чате (в БД не попадает) + тост + текст юзера
   возвращается в **draft созданного чата**. Плашка ошибки сбрасывается
   при уходе из чата или следующей отправке.

```ts
// src/features/chats/lib/update-context-embedding.ts
// updateChatContextData(chatId, text): fire-and-forget
//   1) appendToChatContext → chats.context (FTS обновится триггером)
//   2) getEmbeddingsClient() → нет ключа → тихий выход
//      client.embed([text]) → updateChatEmbedding(chatId, 'context', vector)
//   Любая ошибка тихо пропускается — поиск догонит на следующей итерации
```

### 3.7 Сторы — что хранят, зачем и почему их три

Фича задействует три стора. Разделение не декоративное: каждый живет
в своем ритме обновлений, и смешать их — значит перерисовывать лишнее
(обоснование — в конце раздела и в п.6).

#### templates-store — каталог шаблонов (обновляется редко)

```ts
// src/features/api-templates/model/templates-store.ts
{
  templates: ApiTemplate[];   // весь каталог — кэш таблицы api_templates
  isLoading: boolean;

  loadTemplates(): Promise<void>;            // SELECT * → templates
  addTemplate(input): Promise<ApiTemplate>;  // createTemplate → БД + SecureStore
  deleteTemplate(id): Promise<void>;         // DELETE + ключ из SecureStore
}
```

Хранит ровно то, что лежит в `api_templates` — это in-memory кэш таблицы,
без вычисляемых полей. Список маленький (десятки записей), меняется
только при создании/удалении шаблона, поэтому подписки на него дешевые.
Единственный побочный эффект: `addTemplate` после успешной записи
вызывает `useChatsStore.getState().setLastTemplateId(template.id)` —
новый шаблон сразу становится «последним используемым» и подставляется
во временный чат (юзер создал шаблон → может сразу писать).

#### chats-store — чаты и активный чат (обновляется при навигации)

Основной стор фичи. Полное состояние:

```ts
// src/features/chats/model/chats-store.ts
{
  chats: ChatRecord[];           // список чатов для сайдбара (кэш таблицы)
  activeChatId: string | null;   // null = временный чат
  isLoading: boolean;

  // --- черновики (in-memory, переживают только сессию) ---
  drafts: Record<string, string>; // черновик каждого чата по id
  globalDraft: string;            // черновик временного чата (id еще нет)

  // --- активный чат (загружается loadChat, не хранится в БД-кэше) ---
  activeNotes: NoteRecord[];      // переписка активного чата по возрастанию
  activeTemplate: ApiTemplate | null; // шаблон активного чата (JOIN из БД)

  // --- «последний используемый» шаблон ---
  lastTemplateId: string | null;  // см. ниже — in-memory UI-состояние

  loadChatToken: number;          // защита от гонок загрузки
}
```

Ключевые действия:

```ts
// loadChat(chatId) — открытие чата: инкрементит токен, параллельно
//   тянет getNotes + getTemplateForChat; результат применяется только
//   если activeChatId и токен не изменились. Зачем токен: юзер может
//   быстро кликнуть по двум чатам — ответ первого запроса не должен
//   перетереть notes второго. И обратная гонка: пока loadChat шел,
//   стрим мог дописать appendLocalNote — ранняя загрузка не затирает
//   notes, дописанные после ее старта
// setChatTemplate(chatId, templateId) — UPDATE в БД + chats[] +
//   activeTemplate + lastTemplateId (выбор = «последний используемый»)
// setLastTemplateId(id) — единственный writer lastTemplateId
// initTempChat(title, templateId) — вызывается при отправке во
//   временный чат: createChat в БД, чат в список; активируется только
//   если юзер все еще во временном чате (activeChatId === null) —
//   иначе он уже ушел, и чат просто появится в списке. globalDraft
//   очищается — его текст «уехал» в отправку
// appendLocalNote(note) — push в activeNotes без похода в БД
//   (запись уже сделана репозиторием); так стрим/успех обновляют UI
//   мгновенно, без перезагрузки чата
// clearLoadedChat() — уход во временный чат: activeNotes/activeTemplate
//   сбрасываются (временный чат пока пуст)
// deleteChat — БД + chats[] + чистка activeNotes/activeTemplate,
//   если удален активный чат
```

**`lastTemplateId` — почему in-memory, а не SecureStore.** Это состояние
уровня UI, как drafts: «какой шаблон юзер использовал последний раз».
При перезагрузке приложения оно честно сбрасывается — юзер начнет с
чистого временного чата и выберет шаблон (или создаст новый). Писать это
в SecureStore — значит переживать рестарт там, где переживание не нужно
и даже вредно: «последний шаблон» имеет смысл только внутри сессии.
Пишется ровно в трех местах: выбор в поповере (любой чат), отправка
с шаблоном (после проверки ключа — независимо от исхода запроса),
создание нового шаблона. Отдельного `tempTemplateId` для временного
чата больше нет — временный чат читает `lastTemplateId` напрямую,
это одно и то же значение (дубль был удален как источник рассинхрона).

**`globalDraft` vs `drafts` — почему два черновика.** У обычного чата
черновик ключуется по `id`, которого у временного чата еще нет. Заводить
фейковый id — лишняя сущность; `globalDraft` — просто «черновик чата
без id». При `initTempChat` он очищается: текст либо ушел в запрос,
либо (при ошибке) переехал в `drafts[newId]`.

#### generation-store — «живой» момент отправки (обновляется на каждый токен)

Slim-стор, единственная ответственность — текущая генерация:

```ts
// src/features/chats/model/generation-store.ts
{
  status: 'idle' | 'streaming' | 'error';
  chatId: string | null;          // чат, которому принадлежит стрим/ошибка
  pendingUserText: string | null; // оптимистичное сообщение юзера
  streamingText: string;          // накопленный текст ответа (растет)
  errorText: string | null;       // текст плашки ошибки (не в БД)

  setPendingUser(text)   // пузырь юзера в UI мгновенно, до валидации
  start(chatId)          // статус streaming, тексты сброшены
  appendChunk(accumulated)  // каждый токен стрима
  fail(message)          // статус error, оптимистичный пузырь откатился
  clearError()           // сброс ТОЛЬКО плашки (уход из чата)
  finish() / reset()     // полный сброс после успеха / принудительно
}
```

**Почему отдельный стор, а не поля в chats-store.** `appendChunk`
вызывается на каждый токен — это десятки обновлений в секунду. Если бы
`streamingText` жил в chats-store, каждый токен перерисовывал бы всех
подписчиков: сайдбар, список чатов, инпут. Отдельный стор сужает
перерисовку до `ChatMessages` (стриминговый пузырь) и `useChatInput`
(блокировка `canSend`). Плюс жизненный цикл у них разный: chats-store
живет все сессию, generation-store — ровно одну отправку.

**Почему стрим не сбрасывается при смене чата.** Раньше `ChatMessages`
на смене чата вызывал `reset()` — уход из чата во время стрима убивал
UI-состояние, но не сам `fetch`: запрос докачивался в пустоту, ответ
терялся для глаза. Теперь состояние генерации живет, пока идет стрим,
а видимость гейтится сравнением `generation.chatId === activeChatId`:
в чужом чате стрим не виден, вернулся — видишь его вживую. Исключение —
плашка ошибки: она сбрасывается при уходе (`clearError`), потому что
«вечная» ошибка, которую нельзя убрать, бесит (проверено).

**SecureStore — не стор, а слой хранения.** Ключи шаблонов не живут
ни в одном сторе: `getTemplateKey` читает их из SecureStore только
в момент отправки. Это осознанный запрет на кэширование секретов
в памяти приложения дольше, чем длится запрос.

Почему три, а не один: три разных ритма обновлений (редкий каталог /
навигация / поток токенов) и три разных жизненных цикла (сессия /
сессия / одна отправка). Один общий стор превратил бы каждый токен
стрима в перерисовку всего экрана чата.

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
в `setChatTemplate` (БД + стор), для временного — в `setLastTemplateId`
(только стор, уедет в чат при первой отправке).

Без шаблона: инпут `editable={false}` с плейсхолдером-подсказкой,
у кнопки отправки нейтральный плюсик. С шаблоном: закрашенный кружок
(акцент при `canSend`), отправка активна при непустом черновике и
не идущем стриме.

**Список сообщений** (`ChatMessages.tsx`, встроен в `ChatContent`
вместо TODO-заглушки) — `ScrollView` с пузырями: user справа на акценте,
assistant слева на карточке. Стриминговое сообщение — растущий текст с
курсором `▍`. Ошибка — серая строка по центру (не пузырь, в БД не пише��ся).
Автопрокрутка вниз на каждое изменение.

## 5. Поток данных

Отправка сообще��ия (временный чат):

```
Клик по кнопке отправки (canSend)
↓ sendMessage(null, draft)
↓ generationStore.setPendingUser(text) → пузырь юзера в UI мгновенно
↓ getTemplate(lastTemplateId) → getTemplateKey → SecureStore
↓   (неудача → rollbackUi: пузырь убран, текст вернулся в инпут, тост)
↓ setLastTemplateId(templateId)
↓ initTempChat(title, templateId) → createChat в БД → чат в списке,
↓   активен (юзер в нем и сидит) — вернуться можно в любой момент
↓ messages = [user text] (notes еще пусты)
↓ generationStore.start(chatId)
↓ streamChatCompletion(config, onText)
↓   fetch POST {baseUrl}/chat/completions (stream: true)
↓   reader.read() → TextDecoder → parseSseDataLines → zod → delta.content
↓   onText(accumulated) → generationStore.appendChunk → ChatMessages (▍)
↓   (стрим переживает переключение чатов — живет в фоне)
↓ [DONE] → appendNote(user) + appendNote(assistant) → БД + UI
↓ generationStore.finish()
↓ updateChatContextData(chatId, "user assistant") — fire-and-forget
↓   appendToChatContext → chats.context → FTS-триггер chats_au
↓   embeddings-client → updateChatEmbedding(chatId, 'context', vector)
```

Ошибка на любом шаге запроса:

```
ChatCompletionError / network
↓ generationStore.fail(message) → оптимистичный пузырь юзера откатился,
↓   серая строка ошибки в чате (не в БД)
↓ setDraft(chatId, text) → текст юзера в draft созданного чата
↓ showToast(message)
↓ notes/context/эмбеддинги не тронуты; плашка ошибки сбрасывается
↓   при уходе из чата или следующей отправке
```

Открытие существующего чата:

```
Клик по чату в сайдбаре
↓ setActiveChat(id)
↓ ChatMessages.useEffect: status === 'error' → clearError()
↓   (стрим, если идет, продолжает жить в фоне)
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
3. **Временный чат создается при отправке, а не после ответа** — чат
   сразу появляется в списке, к нему можно вернуться как к обычному;
   стрим переживает переключение чатов. notes пишутся только после
   успешного стрима — неудавшийся запрос не оставляет «одиноких»
   сообщений без ответа, текст юзера возвращается в draft чата.
4. **Ошибка — временное сообщение в сторе, а не запись в notes** —
   неудавшийся запрос не должен попадать в контекст, который уйдет в
   следующий запрос к API. Плашка ошибки сбрасывается при уходе из
   чата — «вечной» ошибки, которую нельзя убрать, нет.
5. **`context`/`notes` вместо возврата к `messages`** — поиск уже построен
   вокруг `chats.context` (FTS + embedding); notes дают историю для API,
   context — денормализованную сводку для поиска, обе сущности каскадно
   чистятся вместе с чатом.
6. **Оптимистичный UI без `useOptimistic`** — хук рассчитан на состояние
   в `useState` компонента, а источник правды у нас zustand-стор,
   обновляемый асинхронно из репозитория. Вместо борьбы с архитектурой
   использован уже существующий паттерн: временные состояния вне БД
   живут в generation-store (как стриминговый пузырь). `pendingUserText`
   показывается мгновенно, при успехе заменяется настоящей note из БД,
   при ошибке откатывается.
7. **notes пишутся только после успешного стрима, парой, атомарно** —
   в БД не бывает «одинокого» сообщения юзера без ответа: если
   `appendNote(assistant)` упал после `appendNote(user)`, user-запись
   откатывается через `deleteNote` и ошибка уходит в общий обработчик
   (плашка + draft + тост). Альтернатива «писать user сразу» оставляла
   бы в чате сообщения без ответа, которые потом попадали бы в контекст
   следующего запроса.
8. **Один слот генерации** — параллельные стримы не поддерживаются
   осознанно: `canSend` блокирует отправку на время стрима и
   оптимистичной фазы. Это убирает целый класс проблем (гонки записи
   notes, несколько стримов в одном чате, порядок ответов) ценой
   одного ограничения, которое юзер почти не замечает.
9. **`lastTemplateId` in-memory, как drafts** — «последний шаблон»
   имеет смысл только внутри сессии; персист в SecureStore переживал
   бы рестарт там, где это не нужно. Пишется в трех точках (выбор,
   отправка, создание шаблона), читается временным чатом напрямую —
   отдельного поля для временного чата нет, дубль удален.
10. **Временный чат = обычный чат с момента отправки** — никакого
    отдельного жизненного цикла «виртуального чата»: после валидации
    он создается в БД и списке, и дальше это обычный чат. Проблемы
    «как вернуться в несуществующий чат» не существует по построению.
    Цена: упавший запрос оставляет чат с черновиком вместо пустоты —
    осознанный трейд-офф, чат можно удалить как обычно.

## Преимущества

- ✅ Ключи API не хранятся в БД — только в SecureStore, читаются в момент отправки
- ✅ Стриминг токен-за-токеном на нативном `expo/fetch`, без внешних SDK
- ✅ Валидация чанков и ошибок API zod-схемами — мусорный поток не роняет UI
- ✅ Ошибка запроса не загрязняет историю: notes/context/эмбеддинги чистые
- ✅ Временный чат создается до запроса — текст не теряется при сбое
- ✅ История чата = notes: и контекст для API, и открытие старого чата одним механизмом
- ✅ Гонки загрузки контекста устранены токеном loadChatToken
- ✅ FTS и эмбеддинг поиска обновляются существующими механизмами, без нового кода
