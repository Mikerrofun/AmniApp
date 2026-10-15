---

**Дата:** 15.10.2026
**Теги:** #features #chat #sidebar #temporary-chat #store

---

## 1. Зачем

Три связанные задачи вокруг создания чатов:

1. **Эмбединг названия только при rename.** При создании чата генерировался эмбединг дефолтного названия («Новый чат») — это бессмысленная работа: до переименования эмбединг не используется, а после rename всё равно перегенерируется.
2. **Формализация временного чата.** Состояние «ничего не выбрано» (текст в `globalDraft`) существовало неявно. Нужен был явный механизм фокуса поля ввода временного чата, не смешанный с фокусом по id реального чата.
3. **Кнопка временного чата + авто-rename нового чата.** Кнопка «Новый чат» в панели должна: не закрывать панель, сразу открывать новый чат в режиме rename (чтобы пользователь назвал его осмысленно), а отдельная кнопка временного чата — переключать в режим «черновика» без активного чата.

## 2. Где/что уже было

- `useChatsStore` (zustand): `chats`, `activeChatId`, `focusChatId`, `drafts`, `globalDraft`. Временный чат = `activeChatId === null`, текст живёт в `globalDraft`; при создании реального чата `globalDraft` стирается.
- `useCreateChat()` — создание чата в БД + активация + `focusChatId` для фокуса инпута.
- `updateTitleEmbedding()` — fire-and-forget перегенерация `title_embedding`, вызывалась и при создании, и при rename.
- `ChatInputArea` — подписка на `focusChatId` (фокус после создания чата).
- `ChatListItem` + `useChatPopover` — popover с режимами меню/rename.
- `SidebarHandler` — триггер слева-сверху, затемнение на mobile (zIndex 40).

## 3. Реализация

### Структура изменений

```
src/features/chats/
  model/
    chats-store.ts          — +focusInputToken, +pendingRenameChatId, +2 экшена
    chats-store.types.ts    — типы новых полей с доками
    use-create-chat.ts      — убран вызов updateTitleEmbedding
  lib/
    update-title-embedding.ts — комментарий: только rename

src/app/(tabs)/chat/components/
  ChatContent/ChatInputArea.tsx       — подписка на focusInputToken
  ChatSidebar/
    ChatListItem/useChatPopover.ts    — авто-rename из сигнала стора
    ChatListItem/ChatListItem.tsx     — прокидывание onRenameComplete
    ChatSidebar.hooks.ts              — handleCreateChat не закрывает панель
    ChatSidebar.tsx                   — onRenameComplete в оба списка
    TempChatButton/                   — новая кнопка (3 файла)
  SidebarHandler/SidebarHandler.tsx   — кнопка справа-сверху

src/shared/i18n/messages/{en,ru}.json — ключ chats.newTempChat
```

### Стор: два новых сигнала

```ts
// chats-store.types.ts
focusInputToken: number;        // счётчик запросов фокуса инпута временного чата
pendingRenameChatId: string | null; // чат, который сразу открыть в rename

// экшены
requestInputFocus: () => void;              // инкремент токена
consumePendingRename: (id: string) => void; // гасит сигнал, если id совпал
```

`createChat` дополнительно выставляет `pendingRenameChatId: chat.id`.

### Фокус инпута временного чата (ChatInputArea)

```ts
const focusInputToken = useChatsStore((state) => state.focusInputToken);
const lastFocusTokenRef = useRef(focusInputToken);

useEffect(() => {
  if (focusInputToken === lastFocusTokenRef.current) return;
  lastFocusTokenRef.current = focusInputToken;
  inputRef.current?.focus();
}, [focusInputToken]);
```

Токен-счётчик, а не булев флаг: фокус срабатывает только на изменение, повторный тап по кнопке снова фокусит, монтирование — нет.

### Авто-rename нового чата (useChatPopover) — подробно

`useChatPopover(chatId, onRenameComplete?)` — единственный владелец логики popover'а элемента списка. Внутри него сосуществуют **два независимых источника состояния**, и понимание их разделения — ключ ко всему механизму.

#### Два источника состояния

```ts
// 1. Локальное состояние — ручные открытия (меню по dots, rename из меню)
const [popover, setPopover] = useState(INITIAL_POPOVER); // { open: false, mode: "menu" }

// 2. Сигнал стора — «этот чат создан кнопкой "Новый чат" и должен
//    открыться в rename прямо сейчас»
const pendingRenameChatId = useChatsStore((s) => s.pendingRenameChatId);
const consumePendingRename = useChatsStore((s) => s.consumePendingRename);
```

Локальное состояние ничего не знает об авто-rename, сигнал стора ничего не знает о ручных открытиях. Они не синхронизируются и не мержатся — вместо этого вычисляется **эффективное** состояние:

```ts
const isAutoRename = pendingRenameChatId === chatId;

const effectivePopover = isAutoRename
  ? { open: true, mode: "rename" as ChatPopoverMode } // сигнал перекрывает всё
  : popover;                                          // иначе — как обычно

// наружу отдаётся только effectivePopover, локальный popover недоступен
return { ..., popover: effectivePopover, ... };
```

#### Как определяется «это авто-rename»

Сравнение — **по id, а не по факту открытия**: `pendingRenameChatId === chatId`. Каждый экземпляр `ChatListItem` знает свой `chatId` и на каждом рендере проверяет, адресован ли сигнал именно ему. Отсюда три следствия:

1. **Сигнал адресный.** После создания чата сигнал видит только один элемент списка — тот, чей `id` совпал. Остальные элементы читают тот же стор, но сравнение даёт `false`, и их popover'ы остаются закрытыми.
2. **Сигнал переживает рендер списка.** Новый чат появляется в `FlatList` асинхронно: в момент `createChat()` элемента ещё нет в DOM. Если бы «открыть rename» было локальным стейтом, его было бы некому выставить. Сигнал лежит в сторе, и когда элемент наконец монтируется, первое же вычисление `effectivePopover` даёт `{ open: true, mode: "rename" }` — popover открывается «сам», без единого эффекта.
3. **Сигнал одноразовый и гасится владельцем.** `consumePendingRename(id)` в сторе затирает `pendingRenameChatId` в `null` **только если id совпал** — защита от гонки: если сигнал уже погашен другим (устаревшим) экземпляром или переустановлен новым созданием чата, чужой `consume` ничего не сломает.

Важно: `isAutoRename` — не флаг «состояние», а **производное значение**, пересчитываемое на каждом рендере из стора. Никакого `useEffect` + `setState` (это запрещено правилом линта react-compiler и давало бы каскадный рендер): сигнал изменился → ререндер подписчика → `effectivePopover` пересчитался → popover открыт. Точка.

#### Кто за что отвечает (возвращаемые ручки)

| Ручка                        | Ответственность                                                            | Авто-rename                                                                               |
| ---------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `popover`                    | Эффективное состояние для рендера (`ChatItemPopover` читает `open`/`mode`) | Вычисляется из сигнала, минуя локальный стейт                                             |
| `openPopover(mode)`          | Ручное открытие: `measure()` якоря + `setPopover`                          | Не участвует — авто-rename открывается без вызова                                         |
| `setMode(mode)`              | Переключение режима внутри открытого popover'а (menu → rename из меню)     | Работает поверх, но в авто-режиме локальный `mode` не читается — сигнал перекрывает       |
| `handlePopoverClose`         | **Единая точка закрытия** — см. ниже                                       | Ветвится по `isAutoRename`                                                                |
| `anchorRef` / `anchor`       | Позиционирование popover'а у кнопки dots                                   | Домер после открытия (нюанс web)                                                          |
| `hoverHandlers` / `showDots` | Видимость кнопки dots (web: hover или открыт popover)                      | `showDots` учитывает `effectivePopover.open`, поэтому dots видны, пока открыт авто-rename |

#### `handlePopoverClose` — ветвление по источнику открытия

```ts
const handlePopoverClose = useCallback(() => {
  if (isAutoRename) {
    // Авто-поток: закрыть popover = завершить сценарий.
    // Локальный setPopover НЕ вызывается — он и так закрыт
    // (сигнал погас → effectivePopover вернётся к локальному
    //  состоянию, которое в авто-потоке никто не открывал).
    consumePendingRename(chatId);
    onRenameComplete?.(); // панель закрывается только здесь
    return;
  }

  // Ручной поток: обычное закрытие локального состояния
  setPopover(INITIAL_POPOVER);
}, [isAutoRename, consumePendingRename, chatId, onRenameComplete]);
```

Ключевая асимметрия: в ручном потоке «закрыть» — это операция над локальным стейтом; в авто-потоке локальный стейт пуст (никто не звал `openPopover`), поэтому «закрыть» — это операция над **сигналом стора**. Гашение сигнала само по себе закрывает popover (производное состояние снова станет `{ open: false }`), а `onRenameComplete` — колбэк наверх (`ChatSidebar.hooks.handleRenameComplete` → `onClose` панели) — вызывается **только** в авто-потоке. Поэтому:

- Save / Cancel / тап вне → `ChatItemPopover` зовёт `onClose` → `handlePopoverClose` → сигнал погашен, панель закрыта. Все три пути завершения сходятся в одну точку.
- Обычный rename из меню (долгий тап по dots → Rename) идёт через `setMode("rename")` и закрывается веткой `setPopover(INITIAL_POPOVER)` — панель **не** закрывается, поведение списка не меняется.

#### Нюанс web: домер якоря

Якорь popover'а (`anchorRef` на кнопке dots) на web монтируется только вместе с открытым popover'ом. В авто-потоке popover открывается производным состоянием — кнопки dots ещё нет в DOM в момент первого рендера, поэтому `measure()` из `openPopover` вызвать некому. Решение — эффект домера:

```ts
useEffect(() => {
  if (effectivePopover.open && !anchor) measure();
}, [effectivePopover.open, anchor, measure]);
```

Пока якоря нет — домеряем на каждом рендере; как только появился (`anchor` стал не-null) — позиционирование выполнено, эффект больше не срабатывает. Без этого авто-rename popover рендерился бы с нулевыми координатами.

### TempChatButton

Логика в хуке `useTempChatButton`, компонент только рендерит:

```ts
const handlePress = () => {
  if (activeChatId === null) {
    setGlobalDraft(""); // уже во временном — чистим черновик
  } else {
    setActiveChat(null); // текст остаётся в драфте активного чата
  }
  requestInputFocus();
  onCloseSidebar?.(); // на десктопе не передаётся
};
```

UI: `Pressable` 30×30, `rounded-full`, стили как у `ChatSidebarTrigger`, иконка `MessageCirclePlus` (lucide) 16px, `hitSlop={6}`, a11y-лейбл `chats.newTempChat`.

Позиция в `SidebarHandler`: справа-сверху (`right: 16, top: topInset + 12`), `zIndex: 30` — ниже затемнения (40), поэтому при открытой панели тап по кнопке попадает в бэкдроп и просто закрывает панель.

## 4. UI

- Кнопка временного чата зеркально триггеру панели: справа-сверху, всегда на экране.
- «Новый чат»: панель остаётся открытой, новый чат появляется в списке и сразу открывается в режиме rename с выделенным текстом.
- Завершение rename (любое) закрывает панель — это единственный путь закрытия после создания через кнопку.

## 5. Поток данных

```
Тап «Новый чат»
  → createChat() → chats[0], activeChatId, focusChatId, pendingRenameChatId
  → ChatListItem рендерится → useChatPopover: pendingRenameChatId === id → mode = rename
  → Save/Cancel/outside → consumePendingRename(id) + onRenameComplete() → панель закрыта

Т��п «Временный чат»
  → activeChatId === null ? setGlobalDraft("") : setActiveChat(null)
  → requestInputFocus() → focusInputToken++
  → ChatInputArea: токен изменился → inputRef.focus()
  → (mobile) onCloseSidebar() → панель закрыта
```

## 6. Почему так, а не иначе

1. **Токен-счётчик вместо расширения `focusChatId` сентинелом.** `focusChatId` — семантика «фокус инпута конкретного чата после создания». Смешивание с «фокус временного чата» через магическое значение грязнит механизм; отдельный счётчик решает и проблему повторных тапов.
2. **`pendingRenameChatId` — одноразовый сигнал в сторе, а не локальный стейт.** Сигнал должен пережить рендер списка (новый чат появляется в FlatList асинхронно) и быть погашен именно тем элементом, которому он адресован (`consumePendingRename(id)` сравнивает id).
3. **Производное состояние вместо `useEffect` + `setState`.** Правило линта react-compiler запрещает setState в эффекте; вывод режима из сигнала стора ещё и убирает лишний каскадный рендер.
4. **Панель не закрывается при создании.** Пользователь должен сразу увидеть новый чат в списке и назвать его. Закрытие привязано к завершению rename — естественная точка окончания сценария.
5. **`setActiveChat(null)` вместо очистки текста.** Текст активного чата остаётся в его драфте — переключение во временный чат не теряет набранное, возврат к чату восстанавливает текст.
6. **zIndex 30 у кнопки временного чата.** Ниже затемнения (40): при открытой панели кнопка визуально видна, но тап уходит в бэкдроп — панель закрывается предсказуемо, без «мёртвых» зон.

## Преимущества

- ✅ Убрана бессмысленная работа: эмбединг дефолтного названия больше не генерируется
- ✅ Временный чат формализован: явный сигнал фокуса, не смешанный с фокусом по id
- ✅ Авто-rename без setState в эффектах — производное состояние из сигнала стора
- ✅ Текст черновика не теряется при переключении во временный чат
- ✅ Логика кнопки в хуке, компонент — только рендер (единый паттерн проекта)
- ✅ Локализация: новый ключ `chats.newTempChat` в en/ru
- ✅ Типобезопасность: tsc и eslint чистые
