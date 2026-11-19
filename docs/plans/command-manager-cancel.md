---

**Дата:** 19.11.2026
**Теги:** #planning #command-manager #cancel #chat

---

# Отмена генерации: CommandManager + крестик в ChatInputArea

**Следуем принципам:** Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven.

---

## Файлы для изучения перед работой

Читать в этом порядке — они дают и общую картину проекта, и конкретное место работы:

1. `src/features/chats/model/use-chat-actions.ts` — главный файл задачи: `sendMessage` содержит весь флоу отправки (оптимистичный пузырь → валидация шаблона/ключа → создание временного чата → стрим → атомарная запись notes → эмбеддинги). Сюда встраивается отмена.
2. `src/features/chats/model/generation-store.ts` + `generation-store.types.ts` — глобальный стор генерации: `status` (`idle | streaming | error`), `pendingUserText`, `streamingText`. Одна генерация на приложение, стрим переживает переключение чатов.
3. `src/lib/ai/openai-compat-client.ts` — `streamChatCompletion` уже принимает третий параметр `signal?: AbortSignal`, но вызывающий код его не передаёт. Механику abort дописывать не нужно — нужно только начать использовать.
4. `src/app/(tabs)/chat/components/ChatContent/ChatInputArea/ChatInputArea.tsx` + `useChatInput.ts` — кнопка отправки (кружок/плюс), `canSend`, `isStreaming`. Сюда встраивается крестик.
5. `src/features/chats/model/chats-store.ts` — `deleteChat`, `setDraft`, `setGlobalDraft`, `initTempChat`, `activeChatId`. Нужны для отката после отмены.
6. `src/app/(tabs)/chat/components/ChatContent/ChatMessages/ChatMessages.tsx` — как рендерятся `pendingUserText` / `streamingText` / `errorText`; важно понимать, что исчезнет при отмене.
7. `src/shared/i18n/messages/ru.json` и `en.json` — куда добавить ключ подписи кнопки отмены.
8. `tests/` — существующие тесты на `node:test` + `tsx` (`npm test`), формат для минимальных тестов менеджера.

Ключевой факт проекта: notes пишутся в БД **только после успешного стрима** (пара user+assistant атомарно). Поэтому при отмене в БД ничего не попадает — нужно только удалить временный чат, созданный до стрима.

---

## Проблемы, которые решаем

**Блок A. Механика отмены (CommandManager)**

1. Отправленный запрос нельзя прервать: `streamChatCompletion` поддерживает `AbortSignal`, но сигнал не передаётся, и фазы валидации/создания чата никак не прерываются.
2. Нет переиспользуемого слоя управления долгими операциями: реестр активных запусков, кооперативная отмена через `AbortController`, типизированная ошибка отмены.

**Блок B. Откат состояния при отмене**

3. При отмене частичный ответ ассистента должен исчезнуть, ничего не записаться в БД, а текст запроса — вернуться в поле ввода (`ChatInputArea`), чтобы его можно было переотправить.
4. Если отменённый запрос создал временный чат — чат удаляется из БД и сайдбара, пользователь остаётся во временном чате; для существующего чата текст возвращается в его черновик.

**Блок C. UI отмены**

5. В `ChatInputArea` на время всего пайплайна (оптимистичная фаза + стриминг) кнопка отправки заменяется крестиком; клик по нему отменяет генерацию. Фидбека после отмены нет — тихо.

---

## Новые файлы (5 шт)

1. `src/shared/lib/command-manager/command-manager.types.ts`
2. `src/shared/lib/command-manager/command-manager.config.ts`
3. `src/shared/lib/command-manager/command-manager.ts`
4. `src/shared/lib/command-manager/index.ts`
5. `tests/command-manager.test.ts`

## Изменяемые файлы (4 шт)

1. `src/features/chats/model/use-chat-actions.ts`
2. `src/app/(tabs)/chat/components/ChatContent/ChatInputArea/useChatInput.ts`
3. `src/app/(tabs)/chat/components/ChatContent/ChatInputArea/ChatInputArea.tsx`
4. `src/shared/i18n/messages/ru.json` + `src/shared/i18n/messages/en.json`

---

## Правила оформления кода (для всех задач)

- **Типизация** — только в файлах типов (`*.types.ts` рядом с логикой по FSD). В файлах с логикой — только импорты типов; структуры, используемые больше одного места, не объявлять inline.
- **Конфиги/константы** — в `*.config.ts` рядом с модулем (как `ChatSidebar.config.ts`, `use-chat-search.config.ts`).
- **FSD** — CommandManager живёт в `shared/lib` (платформенно-независимый, без импортов из `features/` и `app/`); чат-специфичная логика остаётся в `features/chats`.
- **Комментарии** — только на действительно неочевидных местах (например, почему `cancel()` не удаляет запись из реестра до `finally`). Не комментировать каждую строку.

---

## Порядок реализации (4 задачи)

### Задача 1. Каркас CommandManager в `shared/lib`

**Файлы:** `src/shared/lib/command-manager/command-manager.types.ts`, `command-manager.config.ts`, `command-manager.ts`, `index.ts`

**Что делаем:** синглтон-класс управления долгими операциями: реестр активных запусков + кооперативная отмена через `AbortController`. Без привязки к чатам — чистая механика «запуск + отмена».

**Флоу (что реализовать):**

- Состояние класса: `activeCommands: Map<commandId, CommandState>`, где `CommandState` — `controller: AbortController`, `startedAt: Date`.
- Ключ реестра — имя команды из конфига. Для генерации чата — одна константа в `command-manager.config.ts` (например, `CHAT_GENERATION_COMMAND_ID = 'chat_generation'`): генерация в приложении одна глобальная (см. `generation-store`), совпадает с текущим ограничением «один стрим за раз».
- `execute<T>(commandId, handler)`:
  1. Если `commandId` уже в реестре — вернуть `{ status: 'already_running' }`, хендлер не запускать (страховка от параллельного запуска; UI и так блокирует повторную отправку).
  2. Иначе создать `AbortController`, записать `CommandState` в реестр, запустить `handler({ signal, checkCancelled })` — commandId и инструменты отмены передаются хендлеру явно аргументом (асинхронного контекста в RN нет).
  3. `finally` — безусловно удалить запись из реестра при любом исходе (успех / отмена / ошибка).
  4. Возвращаемый тип — дискриминированное объединение: `{ status: 'completed', value: T }` | `{ status: 'cancelled' }` | `{ status: 'already_running' }`. Ошибки хендлера не глотать — пробрасывать наружу (в чат-флоу ошибки обрабатывает `use-chat-actions`).
- `cancel(commandId): boolean`: найти запись, если сигнал ещё не прерван — `controller.abort(reason)` и вернуть `true`; иначе `false`. **Критично: `cancel()` НЕ удаляет запись из реестра** — она живёт до `finally` в `execute()`, иначе последующий `checkCancelled` не увидит `signal.aborted`.
- `checkCancelled(commandId): void`: если записи нет — no-op (тихий выход); если `signal.aborted` — выбросить `CommandCancelledError` с reason из сигнала.
- `isCancelled(commandId): boolean` — вспомогательный метод для различения abort-ошибки fetch от отмены (см. задачу 2).
- `CommandCancelledError` — типизированный класс ошибки по образцу `ChatCompletionError` в `openai-compat-client.ts`: `name`, `reason`. Лежит в `command-manager.types.ts` рядом с типами либо в отдельном `command-manager.errors.ts` — но не внутри файла логики.
- Типы (`CommandState`, `CommandExecuteResult`, тип хендлера) — в `command-manager.types.ts`; константы — в `command-manager.config.ts`; barrel — `index.ts`.

**Проверка:**

1. `npx tsc --noEmit` без ошибок.
2. Модуль не импортирует ничего из `features/` и `app/` (проверить импорты).

### Задача 2. Отмена в `sendMessage` (`use-chat-actions.ts`)

**Файлы:** `src/features/chats/model/use-chat-actions.ts`

**Что делаем:** весь пайплайн после `setPendingUser` заворачивается в `commandManager.execute(...)`, сигнал пробрасывается в `streamChatCompletion`, добавляется ветка тихого отката при отмене.

**Флоу (что реализовать):**

- Текущий `sendMessage` после `setPendingUser(trimmed)` делает: валидация шаблона → чтение ключа → `initTempChat` → `getNotes` → `streamChatCompletion` → атомарная запись notes → эмбеддинги. Всё это становится телом хендлера внутри `commandManager.execute(CHAT_GENERATION_COMMAND_ID, handler)`. `rollbackUi` и ранние `return` с тостами остаются внутри хендлера — они не отмены, а обычные отказы.
- Сигнал из хендлера передаётся третьим аргументом в `streamChatCompletion` (параметр уже существует, см. `openai-compat-client.ts`).
- **Контрольные точки отмены** (вызовы `checkCancelled` из хендлера): после каждого `await` фазы валидации (шаблон, ключ) и после `initTempChat`/`getNotes` — до старта стрима. Во время стрима отмену обеспечивает сам `AbortSignal`: fetch бросит abort-ошибку, цикл чтения прервётся.
- **Граница отмены — конец стрима.** После того как `streamChatCompletion` вернул полный текст, отмена больше не действует: атомарная запись пары user+assistant (существующий код с `deleteNote`-откатом) выполняется без контрольных точек. Требование: прерывается, только если генерация ещё не завершилась полностью.
- **Различение отмены и ошибки:** в catch хендлера — если пойман `CommandCancelledError`, либо `commandManager.isCancelled(...)`, либо abort-ошибка fetch при прерванном сигнале — пометить как отмену (НЕ ветка `fail()`). Иначе — существующая ветка ошибки (`generation.fail`, `setDraft`, toast) без изменений.
- **Ветка отмены в `sendMessage`** (после того как `execute` вернул `{ status: 'cancelled' }`), всё тихо, без тостов и плашек:
  1. Сбросить `generation-store` в idle (существующий `finish()`/`reset()`: `pendingUserText: null`, `streamingText: ''`), чтобы оптимистичный пузырь и стрим-пузырь исчезли (рендер — `ChatMessages.tsx`).
  2. Если исходный `chatId` был не null (существующий чат): `setDraft(chatId, trimmed)` — текст возвращается в черновик этого чата.
  3. Если исходный `chatId` был null (временный чат): удалить созданный хендлером чат через `deleteChat(targetChatId)` из `chats-store` (в нём гарантированно нет notes — запись не начиналась), вернуть текст в глобальный черновик `setGlobalDraft(trimmed)` и убедиться, что пользователь остаётся во временном чате: если `activeChatId === targetChatId`, сбросить `activeChatId` в `null`. Проверить в `chats-store.ts`, есть ли готовый экшен для сброса `activeChatId`; если нет — добавить минимальный экшен (тип — в `chats-store.types.ts`).
  4. Частичный текст стрима просто выбрасывается — он нигде не сохранялся.
- `cancelGeneration` — новый колбэк, возвращаемый из `useChatActions`: вызывает `commandManager.cancel(CHAT_GENERATION_COMMAND_ID)`. Логика отмены не должна знать про UI, UI не должен знать про внутренности хендлера.
- Комментарий оставить один: на границе отмены «после успешного стрима отмена не действует» — это самое неочевидное место.

**Проверка:**

1. `npx tsc --noEmit` без ошибок.
2. Ручной тест: отправить запрос, во время стрима нажать крестик → пузыри исчезают, текст возвращается в инпут, в БД (проверить через список чатов/notes) ничего не появилось.
3. Ручной тест: отменить в первые мгновения (фаза валидации) — то же самое, временный чат не остался в сайдбаре.
4. Ручной тест: дождаться полного ответа — крестик исчез, кнопка отправки вернулась, notes записаны как раньше.
5. Ручной тест: обычная ошибка API (неверный ключ) — старое поведение не сломалось (плашка ошибки, текст в draft).

### Задача 3. Крестик в `ChatInputArea`

**Файлы:** `src/app/(tabs)/chat/components/ChatContent/ChatInputArea/useChatInput.ts`, `ChatInputArea.tsx`, `src/shared/i18n/messages/ru.json`, `en.json`

**Что делаем:** на время генерации кнопка отправки заменяется крестиком отмены.

**Флоу (что реализовать):**

- В `useChatInput` уже вычисляется `isStreaming` (`status === 'streaming' || pendingUserText !== null`) — это и есть окно крестика, покрывает весь пайплайн (отмена доступна с момента отправки). Добавить `cancelGeneration` из `useChatActions` и вернуть из хука `handleCancel` (вызов без условий — крестик физически виден только пока `isStreaming`).
- В `ChatInputArea.tsx` в существующем `Pressable` кнопки (справа, блок «Кнопка отправки»): если `isStreaming` — рендерить иконку `X` из `lucide-react-native` (пакет уже используется: `KeyRound`, `Plus`), `onPress={handleCancel}`; иначе — текущее поведение (кружок/плюс, `onPress={handleSend}`, `disabled={!canSend}`).
- Accessibility: `accessibilityLabel` — новый i18n-ключ `chatInput.cancel` (ru: «Отменить запрос», en: «Cancel request»); добавить ключ в оба файла сообщений по образцу существующих `chatInput.*`.
- Стили крестика — в рамках текущей капсулы (`h-9 w-9 rounded-full`), цвет из `colors` (`src/shared/config/colors.ts`), без новых дизайн-токенов.
- Комментарии не добавлять — замена иконки очевидна.

**Проверка:**

1. `npx tsc --noEmit` без ошибок.
2. Ручной тест: во время генерации виден крестик вместо кнопки отправки; после завершения/отмены — кнопка возвращается.
3. Ручной тест: во время генерации ввод в поле работает (текст набирается), отправка заблокирована как раньше.

### Задача 4. Минимальные тесты CommandManager

**Файлы:** `tests/command-manager.test.ts`

**Что делаем:** минимальный набор на `node:test` + `tsx` (формат — как существующие тесты в `tests/`, запуск `npm test`). Только чистая механика менеджера, без чат-флоу — не перегружать.

**Флоу (что покрыть — ровно 3 кейса):**

1. **Регистрация и cleanup:** `execute` с быстрым хендлером возвращает `{ status: 'completed', value }`, после завершения повторный `execute` не возвращает `already_running` (реестр чист).
2. **Отмена:** хендлер останавливается на управляемом промисе-шлюзе после контрольной точки `checkCancelled`; снаружи вызывается `cancel`; шлюз освобождается; `execute` возвращает `{ status: 'cancelled' }`, повторный `execute` снова работает (запись удалена в `finally`).
3. **Блокировка:** второй `execute` с тем же commandId во время активного первого возвращает `{ status: 'already_running' }` и не запускает второй хендлер.

**Проверка:**

1. `npm test` — все тесты зелёные, включая существующие.

---

## Финальная проверка

```bash
npx tsc --noEmit
npm test
npx expo lint
```

**Ручное тестирование:**

- [ ] Отмена во время стрима: пузыри исчезли, текст вернулся в инпут, в БД ничего не записано.
- [ ] Отмена в фазе валидации: временный чат не появился в сайдбаре.
- [ ] Отмена во временном чате: остались во временном чате, текст в инпуте, можно переотправить.
- [ ] Отмена в существующем чате: чат остался, текст в его черновике.
- [ ] Полный ответ без отмены: notes записаны, эмбеддинги обновились, кнопка отправки вернулась.
- [ ] Ошибка API: старое поведение (плашка, draft) не сломано.
- [ ] Крестик доступен с момента отправки (включая фазу до стрима).

---

## Итоговая схема изменений

```
Новые файлы (5):
├─ src/shared/lib/command-manager/command-manager.types.ts
├─ src/shared/lib/command-manager/command-manager.config.ts
├─ src/shared/lib/command-manager/command-manager.ts
├─ src/shared/lib/command-manager/index.ts
└─ tests/command-manager.test.ts

Изменяемые файлы (4):
├─ src/features/chats/model/use-chat-actions.ts
├─ src/app/(tabs)/chat/components/ChatContent/ChatInputArea/useChatInput.ts
├─ src/app/(tabs)/chat/components/ChatContent/ChatInputArea/ChatInputArea.tsx
└─ src/shared/i18n/messages/ru.json + en.json
```

---

**Готово!** План покрывает все три блока (механика отмены, откат состояния, UI), следует принципам, содержит проверки. Подтверждаешь?
