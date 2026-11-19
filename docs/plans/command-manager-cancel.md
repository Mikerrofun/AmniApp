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
3. `src/lib/ai/openai-compat-client.ts` — `streamChatCompletion` **уже принимает** третий параметр `signal?: AbortSignal`, но вызывающий код его не передаёт. Механику abort дописывать не нужно — нужно только начать использовать.
4. `src/app/(tabs)/chat/components/ChatContent/ChatInputArea/ChatInputArea.tsx` + `useChatInput.ts` — кнопка отправки (кружок/плюс), `canSend`, `isStreaming`. Сюда встраивается крестик.
5. `src/features/chats/model/chats-store.ts` — `deleteChat`, `setDraft`, `setGlobalDraft`, `initTempChat`, `activeChatId`. Нужны для отката после отмены.
6. `src/app/(tabs)/chat/components/ChatContent/ChatMessages/ChatMessages.tsx` — как рендерятся `pendingUserText` / `streamingText` / `errorText`; важно понимать, что исчезнет при отмене.
7. `src/shared/i18n/messages/ru.json` и `en.json` — куда добавить ключ подписи кнопки отмены.
8. `tests/` — существующие тесты на `node:test` + `tsx` (`npm test`), формат для минимальных тестов менеджера.

Ключевой факт проекта: notes пишутся в БД **только после успешного стрима** (пара user+assistant атомарно). Поэтому «стереть запрос из БД» при отмене означает: ничего не записать + удалить временный чат, созданный до стрима.

---

## Проблемы, которые решаем

**Блок A. Механика отмены (CommandManager)**

1. Отправленный запрос нельзя прервать: `streamChatCompletion` поддерживает `AbortSignal`, но сигнал не передаётся, и фазы валидации/создания чата никак не прерываются.
2. Нет переиспользуемого слоя управления долгими операциями (аналог CommandManager из телеграм-бота): реестр активных запусков, кооперативная отмена через `AbortController`, типизированная ошибка отмены.

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

- **Типизация** — только в файлах типов (`*.types.ts` рядом с логикой по FSD). В файлах с логикой — только импорты типов, никаких inline-объявлений структур, которые используются больше одного места.
- **Конфиги/константы** — в `*.config.ts` рядом с модулем (как `ChatSidebar.config.ts`, `use-chat-search.config.ts`).
- **FSD** — CommandManager живёт в `shared/lib` (платформенно-независимый, без импортов из `features/` и `app/`); чат-специфичная логика остаётся в `features/chats`.
- **Комментарии** — только на действительно неочевидных местах (например, почему `cancel()` не удаляет запись из реестра до `finally`). Не комментировать каждую строку.

---

## Порядок реализации (4 задачи)

### Задача 1. Каркас CommandManager в `shared/lib`

**Файлы:** `src/shared/lib/command-manager/command-manager.types.ts`, `command-manager.config.ts`, `command-manager.ts`, `index.ts`

**Что делаем:** портируем паттерн CommandManager из телеграм-бота, адаптированный под RN. Это синглтон-класс без привязки к чатам — чистая механика «запуск + отмена».

**Флоу (что реализовать и на что ссылаться):**

- Структура повторяет бота (`src/shared/utils/CommandManager/CommandManager.ts` из старого проекта, описание в переписке): `activeCommands: Map<commandId, CommandState>` + `execute()` + `cancel()` + `checkCancelled()` + `CommandCancelledError`.
- Отличия от бота, вынужденные платформой:
  - **AsyncLocalStorage в RN нет** — commandId передаётся в хендлер явно (аргументом), а не через асинхронный контекст. `checkCancelled(commandId)` принимает id параметром.
  - Ключ реестра — не `${userId}_${commandName}`, а имя команды из конфига. Для генерации чата — одна константа в `command-manager.config.ts` (например, `CHAT_GENERATION_COMMAND_ID = 'chat_generation'`): генерация в приложении одна глобальная (см. `generation-store`), совпадает с текущим ограничением «один стрим за раз».
  - Нет `ctx`/`ctx.reply` из gramY — никаких сообщений менеджер не отправляет, только управляет жизненным циклом.
- `execute<T>(commandId, handler)`:
  1. Если `commandId` уже в реестре — вернуть `{ status: 'already_running' }` (аналог блокировки per-user из бота; UI и так блокирует повторную отправку, это страховка).
  2. Иначе создать `AbortController`, записать в реестр `CommandState` (`controller`, `startedAt`), запустить `handler({ signal, checkCancelled })`.
  3. `finally` — безусловно удалить запись из реестра (как шаг 6 из бота: успех / отмена / ошибка — всегда).
  4. Возвращаемый тип — дискриминированное объединение: `{ status: 'completed', value }` | `{ status: 'cancelled' }` | `{ status: 'already_running' }`. Ошибки хендлера не глотать — пробрасывать наружу (в чат-флоу ошибки обрабатывает `use-chat-actions`).
- `cancel(commandId)`: найти запись, если сигнал ещё не прерван — `controller.abort(reason)`. **Критично (как в боте): `cancel()` НЕ удаляет запись из реестра** — она живёт до `finally` в `execute()`, иначе последующий `checkCancelled` не увидит `signal.aborted`.
- `checkCancelled(commandId)`: если записи нет — no-op (тихий выход, как в боте); если `signal.aborted` — выбросить `CommandCancelledError` с reason из сигнала.
- `isCancelled(commandId): boolean` — вспомогательный метод для различения abort-ошибки fetch от отмены (см. задачу 2).
- `CommandCancelledError` — типизированный класс ошибки (аналог `ChatCompletionError` в `openai-compat-client.ts`): `name`, `reason`. Класс ошибки лежит в `command-manager.types.ts` рядом с типами либо в отдельном `command-manager.errors.ts` — по усмотрению, но не внутри файла логики.
- Типы (`CommandState`, `CommandExecuteResult`, тип хендлера) — в `command-manager.types.ts`; константы — в `command-manager.config.ts`; barrel — `index.ts`.

**Проверка:**

1. `npx tsc --noEmit` без ошибок.
2. Модуль не импортирует ничего из `features/` и `app/` (проверить глазами импорты).

### Задача 2. Отмена в `sendMessage` (`use-chat-actions.ts`)

**Файлы:** `src/features/chats/model/use-chat-actions.ts`

**Что делаем:** весь пайплайн после `setPendingUser` заворачивается в `commandManager.execute(...)`, сигнал пробрасывается в `streamChatCompletion`, добавляется ветка тихого отката при отмене.

**Флоу (что реализовать и на что ссылаться):**

- Текущий `sendMessage` (см. файл) после `setPendingUser(trimmed)` делает: валидация шаблона → чтение ключа → `initTempChat` → `getNotes` → `streamChatCompletion` → атомарная запись notes → эмбеддинги. Всё это становится телом хендлера внутри `commandManager.execute(CHAT_GENERATION_COMMAND_ID, handler)`. `rollbackUi` и ранние `return` с тостами остаются внутри хендлера — они не отмены, а обычные отказы.
- Сигнал из хендлера передаётся третьим аргументом в `streamChatCompletion` (параметр уже существует, ссылка — `openai-compat-client.ts`).
- **Контрольные точки отмены** (вызовы `checkCancelled` из хендлера): после каждого `await` фазы валидации (шаблон, ключ) и после `initTempChat`/`getNotes` — до старта стрима. Во время стрима отмену обеспечивает сам `AbortSignal`: fetch бросит abort-ошибку, цикл чтения прервётся.
- **Граница отмены — конец стрима.** После того как `streamChatCompletion` вернул полный текст, отмена больше не действует: атомарная запись пары user+assistant (существующий код с `deleteNote`-откатом) выполняется без контрольных точек. Это соответствует требованию «прерывается, только если ещё не завершился полностью».
- **Различение отмены и ошибки:** в catch хендлера — если `commandManager.isCancelled(...)` либо пойман `CommandCancelledError`, либо abort-ошибка fetch при прерванном сигнале — пробросить/пометить как отмену (НЕ ветка `fail()`). Иначе — существующая ветка ошибки (`generation.fail`, `setDraft`, toast) без изменений.
- **Ветка отмены в `sendMessage`** (после того как `execute` вернул `{ status: 'cancelled' }`), всё тихо, без тостов и плашек:
  1. Сбросить `generation-store` в idle (существующий `finish()`/`reset()` — `pendingUserText: null`, `streamingText: ''`), чтобы оптимистичный пузырь и стрим-пузырь исчезли (рендер — `ChatMessages.tsx`).
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

**Флоу (что реализовать и на что ссылаться):**

- В `useChatInput` уже вычисляется `isStreaming` (`status === 'streaming' || pendingUserText !== null`) — это и есть окно крестика, покрывает весь пайплайн (решение: отмена доступна с момента отправки). Добавить `cancelGeneration` из `useChatActions` и вернуть из хука `handleCancel` (вызов без условий — крестик физически виден только пока `isStreaming`).
- В `ChatInputArea.tsx` в существующем `Pressable` кнопки (справа, ссылка на текущий блок «Кнопка отправки»): если `isStreaming` — рендерить иконку `X` из `lucide-react-native` (уже используется в проекте: `KeyRound`, `Plus`), `onPress={handleCancel}`; иначе — текущее поведение (кружок/плюс, `onPress={handleSend}`, `disabled={!canSend}`).
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

**Флоу (что покрыть — ровно 3 кейса, по аналогии с тестами CommandManager из бота):**

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
