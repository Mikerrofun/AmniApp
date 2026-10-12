# Рефакторинг чат-сайдбара и поля ввода

Краткая заметка по рефакторингу: что было плохо, как переделано, где что подключается. Подробная фича-заметка — `docs/features/chat-input-drafts-i18n.md`.

---

## 1. Popover: монолит → конфиг-мапа + компоненты

**Было:** `ChatItemPopover.tsx` — один файл на ~200 строк: switch по модам, внутри инлайн-разметка rename/delete/pin, состояние формы, валидация. Любой новый мод — правка монолита.

**Стало:** три файла, каждый со своей ролью:

```
ChatSidebar/ChatListItem/
├── ChatItemPopover.tsx          # обертка: читает mode, рендерит из конфига
├── ChatItemPopover.config.tsx   # мапа mode -> компонент
├── ChatItemPopover.types.ts     # типы модов и пропсов
├── ChatPopoverRename.tsx        # переименование (своя форма и состояние)
└── ChatPopoverDelete.tsx        # подтверждение удаления
```

Ядро рефакторинга — конфиг-мапа:

```tsx
// ChatItemPopover.config.tsx
import { ChatPopoverRename } from './ChatPopoverRename';
import { ChatPopoverDelete } from './ChatPopoverDelete';

/** Мапа мода popover'а на его содержимое */
export const POPOVER_CONTENT: Record<ChatPopoverMode, ComponentType<ChatPopoverContentProps>> = {
  rename: ChatPopoverRename,
  delete: ChatPopoverDelete,
};
```

```tsx
// ChatItemPopover.tsx — вся логика обертки
const Content = POPOVER_CONTENT[mode];
return <Content chat={chat} onClose={close} />;
```

**Как расширять:** новый мод «archive» = новый компонент + одна строка в `POPOVER_CONTENT`. `ChatItemPopover.tsx` не трогается — он не знает про конкретные моды.

---

## 2. Драфты: БД → память стора

**Было:** драфт текста писался в колонку `draft` таблицы chats в SQLite. Проблемы: асинхронная запись на каждый keystroke, сессионные данные жили вечно, лишняя колонка в схеме.

**Стало:** два поля в `chats-store`:

```ts
// src/features/chats/model/chats-store.ts
drafts: Record<string, string>;  // драфт по chatId
globalDraft: string;             // драфт временного чата (activeChatId === null)
```

Запись/чтение — через хук, инкапсулирующий выбор «куда писать»:

```ts
// src/features/chats/model/use-chat-draft.ts
const setDraft = (text: string) => {
  if (chatId == null) setGlobalDraft(text);
  else setDraftFor(chatId, text);
};
```

**Миграция схемы** — снос колонки у существующих юзеров:

```ts
// src/lib/db/migrations.ts
if (currentVersion < 2) {
  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(chats)',
  );
  // guard: у новых юзеров колонки уже нет (создается без нее)
  if (columns.some((c) => c.name === 'draft')) {
    await db.execAsync('ALTER TABLE chats DROP COLUMN draft');
  }
  await db.execAsync(`PRAGMA user_version = 2`);
}
```

---

## 3. Убран key-ремаунт поля ввода

**Было:** `<ChatInputArea key={activeChat.id} ...>` — React полностью пересоздавал компонент при смене чата, чтобы сбросить внутренний текст `TextInput`. Побочный эффект: терялось состояние (фокус, анимации), лишние монтирования.

**Стало:** источник текста вынесен наружу — компонент контролируемый, читает драфт из стора через `useChatDraft(chatId)`. При смене чата хук просто начинает читать другой драфт — пересоздание не нужно, `key` удален.

**Правило:** `key` для сброса состояния — костыль; если состояние можно выразить данными из стора, выноси его наружу.

---

## 4. ScrollIndicator: локальная логика → общий компонент

**Было:** логика тумбы прокрутки (высота, позиция, видимость) была вписана в компонент списка чатов.

**Стало:** переиспользуемая пара в `src/shared/components/ui/ScrollIndicator/`:

- `useScrollIndicator.ts` — математика: `thumbHeight = viewport / contentHeight * trackHeight`, `thumbTop = offset / (contentHeight - viewport) * (trackHeight - thumbHeight)`, `isVisible = contentHeight > viewport`. Источники данных: `onScroll`, `onContentSizeChange`, `onLayout`.
- `ScrollIndicator.tsx` — отрисовка тумбы (side, inset, цвет).

Подключение — три пропа на скролл-контейнер + компонент рядом:

```tsx
const scroll = useScrollIndicator({ verticalPadding: 8 });

<SectionList
  onScroll={scroll.onScroll}
  onContentSizeChange={scroll.onContentSizeChange}
  onLayout={scroll.onLayout}
  ...
/>
<ScrollIndicator
  isVisible={scroll.isVisible}
  thumbHeight={scroll.thumbHeight}
  thumbTop={scroll.thumbTop}
  side="right"
/>
```

---

## 5. Клавиатура: KeyboardAvoidingView → ручной замер

**Было:** `KeyboardAvoidingView` с `behavior` по платформе. На Android в edge-to-edge режиме (Expo SDK 53+, Expo Go) окно не ресайзится и behavior игнорируется — поле ввода оставалось под клавиатурой. Плюс подъем на полную высоту клавиатуры оставлял input слишком высоко.

**Стало:** `useKeyboardInset(inputRef)` — свой хук:

- Android: события `keyboardDidShow/DidHide` + своя анимация 200мс;
- iOS: `keyboardWillShow/WillHide` (успевает за системной анимацией);
- web: перекрытие через `visualViewport`;
- высота подъема — **фактическое перекрытие** input'а: `measureInWindow` нижнего края контейнера против верха клавиатуры + зазор 8px. Сам учитывает таб-бар и safe area.

```tsx
// ChatContent.tsx
const inputRef = useRef<View>(null);
const keyboardInset = useKeyboardInset(inputRef);

<Animated.View style={{ paddingBottom: keyboardInset }}>
  <View ref={inputRef}>
    <ChatInputArea chatId={...} />
  </View>
</Animated.View>
```

---

## Итог

| Было | Стало | Эффект |
|---|---|---|
| Монолитный popover на 200 строк | Конфиг-мапа + 3 компонента | Новый мод без правки обертки |
| Драфт в SQLite | Два поля стора + миграция v2 | Нет записи на keystroke, чистая схема |
| `key` на ChatInputArea | Контролируемый компонент | Нет ремаунтов, состояние сохраняется |
| Логика тумбы внутри списка | `shared/ui/ScrollIndicator` | Переиспользование в любых списках |
| KeyboardAvoidingView | `useKeyboardInset` + замер | Работает на всех платформах, точный подъем |
