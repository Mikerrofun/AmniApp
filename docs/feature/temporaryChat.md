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

### Авто-rename нового чата (useChatPopover)

Сигнал стора выводится в производное состояние — без `setState` в эффекте (правило линта react-compiler) и без каскадного рендера:

```ts
const pendingRenameChatId = useChatsStore((s) => s.pendingRenameChatId);
const consumePendingRename = useChatsStore((s) => s.consumePendingRename);

// производное состояние, а не useEffect+setState
const autoRename = pendingRenameChatId === chatId;
const mode = autoRename ? "rename" : manualMode;

const handlePopoverClose = () => {
  if (autoRename) {
    consumePendingRename(chatId);
    onRenameComplete?.(); // панель закрывается только здесь
  }
  setManualMode(null);
};
```

- Save/Cancel/тап вне → сигнал погашен, `onRenameComplete` → панель закрывается.
- Обычный rename из меню поведение панели не меняет.
- Нюанс web: якорь popover'а монтируется только при открытом popover'е, поэтому после открытия нужен домер якоря — иначе авто-rename не позиционируется.

### TempChatButton

Логика в хуке `useTempChatButton`, компонент только рендерит:

```ts
const handlePress = () => {
  if (activeChatId === null) {
    setGlobalDraft("");            // уже во временном — чистим черновик
  } else {
    setActiveChat(null);           // текст остаётся в драфте активного чата
  }
  requestInputFocus();
  onCloseSidebar?.();              // на десктопе не передаётся
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

Тап «Временный чат»
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
