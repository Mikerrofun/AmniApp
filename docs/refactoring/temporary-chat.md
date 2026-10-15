# Temporary chat — follow-up итерация

Дата: 2026-10-15
Ветка: `TemporaryChat`
Связано: `docs/feature/temporaryChat.md` (полное описание фичи)

Каждый блок ниже устроен одинаково: **что делает → флоу по шагам → минимальный код**.

---

## 1. Эмбединг названия — только при rename

**Что делает.** `title_embedding` пишется единственной точкой — `handleRename` в `use-chat-actions.ts`. При создании чата эмбединг не генерируется: эмбединг дефолтного «New chat» бесполезен (не отличает такие чаты друг от друга).

**Флоу.**
1. Создание чата → в БД пишется только title «New chat», эмбединга нет.
2. Пользователь переименовал → `renameChat(id, title)` → `updateTitleEmbedding(id, title)` (fire-and-forget).
3. Cancel / закрытие авто-rename → эмбединг не пишется, чат остаётся без него до первого rename.

**Код** (`use-chat-actions.ts`):

```ts
const handleRename = useCallback(async (id: string, title: string) => {
  await renameChat(id, title);
  // fire-and-forget: отсутствие ключа — тихая деградация
  void updateTitleEmbedding(id, title);
}, []);
```

## 2. Guard на неизменённое название

**Что делает.** Save с текстом, совпадающим с текущим названием, ничего не перезаписывает — ни title в БД, ни эмбединг. Работает и для авто-rename («New chat» сохранили как есть → ничего не записалось), и для обычного rename.

**Флоу.**
1. Открыт popover rename, текст не менялся.
2. Save → `isUnchanged === true` → просто `close()`, `onRename` не вызывается.
3. Текст изменился → обычный путь: `onRename` → rename + эмбединг.

**Код** (`ChatPopoverRename.tsx`):

```ts
const canSave = renameText.trim().length > 0;
// Название не изменилось — Save ничего не перезаписывает
const isUnchanged = renameText.trim() === chat.title;

const handleSave = () => {
  if (!canSave || isUnchanged) {
    close();
    return;
  }
  onRename(chat.id, renameText.trim());
  close();
};
```

## 3. Сигналы стора: focusInputToken и pendingRenameChatId

**Что делает.** Два одноразовых сигнала в `chats-store`:
- `focusInputToken: number` + `requestInputFocus()` — фокус поля ввода временного чата. Счётчик, а не флаг: повторный вызов снова меняет значение, и подписчик видит «изменение».
- `pendingRenameChatId: string | null` + `consumePendingRename(id)` — авто-rename нового чата (подробно в разделе 7).

**Флоу (фокус).**
1. Кнопка временного чата вызывает `requestInputFocus()` → `focusInputToken++`.
2. `ChatInputArea` подписан на токен; в ref хранит последнее виденное значение.
3. Токен изменился → фокус на `TextInput`. При монтировании эффекта не срабатывает (значение равно ref) — фокус только по явному запросу.

**Код** (`ChatInputArea.tsx`):

```ts
const focusInputToken = useChatsStore((s) => s.focusInputToken);
const lastFocusTokenRef = useRef(focusInputToken);

useEffect(() => {
  if (focusInputToken === lastFocusTokenRef.current) return;
  lastFocusTokenRef.current = focusInputToken;
  inputRef.current?.focus();
}, [focusInputToken]);
```

## 4. Кнопка временного чата (TempChatButton)

**Что делает.** Кнопка справа от триггера панели. Переключает в режим «ничего не выбрано», фокусит ввод, закрывает панель (кроме десктопа), лёгкий haptic. Повторное нажатие во временном чате — no-op с тостом.

**Флоу.**
1. Нажатие → haptic (`expo-haptics`, guard `Platform.OS !== "web"`).
2. Мы в обычном чате → `setActiveChat(null)`: текст остаётся в драфте этого чата, не теряется. Затем `requestInputFocus()` → закрытие панели.
3. Мы уже во временном чате → **ничего не делаем**, только тост «Вы уже в новом чате». Драфт и фокус намеренно не трогаются: раньше эта ветка стирала `globalDraft` (можно было потерять набранный текст) и была источником ошибки при повторном нажатии.

**Код** (`useTempChatButton.ts`):

```ts
const handlePress = useCallback(() => {
  if (Platform.OS !== "web") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  if (activeChatId === null) {
    showToast(t("chats.alreadyInNewChat"));
    return;
  }

  setActiveChat(null);
  requestInputFocus();
  onCloseSidebar?.();
}, [t, activeChatId, setActiveChat, requestInputFocus, onCloseSidebar]);
```

## 5. Cross-fade переход при смене чата

**Что делает.** В `ChatContent` контент (хедер + empty-state) анимируется при любой смене активного чата: чат ↔ временный и чат ↔ чат. Старый слой гаснет, новый приезжает сверху с лёгким сдвигом.

**Флоу.**
1. `activeChatId` изменился → `key` слоя сменился → Reanimated размонтирует старый слой и монтирует новый.
2. Старый уходит `FadeOut` 150ms, новый появляется `FadeInDown` 200ms с задержкой 80ms (старый начинает гаснуть чуть раньше).
3. Слои `absoluteFill` — во время перехода перекрываются, а не выталкивают друг друга из layout.

**Код** (`ChatContent.tsx`):

```tsx
<Animated.View
  key={activeChat?.id ?? "temp"}
  entering={FadeInDown.duration(200).delay(80)}
  exiting={FadeOut.duration(150)}
  className="flex-1"
  style={StyleSheet.absoluteFill}
>
  {/* хедер активного чата или empty-state временного */}
</Animated.View>
```

## 6. Размеры кнопок

Триггер панели и кнопка временного чата — зеркальная пара, обе 38px (было 30, +8px). Иконка внутри кнопки временного чата — 16px: 24 занимала всю ширину кружка, 18 — промежуточный вариант.

## 7. Авто-rename нового чата (pendingRenameChatId)

**Что делает.** После нажатия «Новый чат» элемент списка сразу открывается в режиме rename, панель сайдбара остаётся открытой и закрывается только по завершении rename.

**Флоу.**
1. «Новый чат» → `createChat()` пишет в БД и ставит в стор `pendingRenameChatId = <id>`. Панель **не** закрывается.
2. Новый элемент появляется в `FlatList` асинхронно — позже самого сигнала. Сигнал лежит в сторе и «догоняет» элемент: когда тот смонтируется, первое же сравнение даёт совпадение.
3. `ChatListItem` → `useChatPopover(chatId, onRenameComplete)`: `pendingRenameChatId === chatId` — производное состояние, без эффектов. Совпало → popover рендерится сразу открытым в режиме rename.
4. Save / Cancel / тап вне → `handlePopoverClose`: сигнал гасится (`consumePendingRename(id)`), вызывается `onRenameComplete` → панель закрывается. Все три пути завершения сходятся в одну точку.
5. Обычный rename через меню dots идёт мимо: сигнал не выставляется, панель не закрывается.

**Код** (`chats-store.ts`, `useChatPopover.ts`):

```ts
// стор: createChat
set((state) => ({
  chats: [chat, ...state.chats],
  activeChatId: chat.id,
  pendingRenameChatId: chat.id, // сигнал авто-rename
  globalDraft: "",
}));

// useChatPopover: производное состояние, а не useEffect+setState
const isAutoRename = pendingRenameChatId === chatId;
const effectivePopover = isAutoRename
  ? { open: true, mode: "rename" as ChatPopoverMode }
  : popover;

const handlePopoverClose = useCallback(() => {
  if (isAutoRename) {
    consumePendingRename(chatId); // гасим сигнал — popover закрывается сам
    onRenameComplete?.();         // панель закрывается только здесь
    return;
  }
  setPopover(INITIAL_POPOVER);    // ручной поток — обычное закрытие
}, [isAutoRename, consumePendingRename, chatId, onRenameComplete]);
```

Почему сигнал в сторе, а не в локальном состоянии: компонент элемента списка ещё не существует в момент `createChat()` — выставлять было бы некому. Сигнал адресный (совпадает только один элемент), одноразовый (`consumePendingRename` затирает его только при совпадении id — защита от гонки) и переживает рендер списка.

Нюанс web: якорь popover'а (кнопка dots) монтируется только вместе с открытым popover'ом, поэтому в авто-потоке нужен эффект домера — пока якоря нет, меряем на каждом рендере, как появился — остановились.

## 8. Универсальный тост

**Что делает.** `src/shared/components/ui/Toast/` — тост «вызвал и забыл»: серый скруглённый контейнер (`bg-neutral-800/95`, `rounded-xl`), белый текст, по центру экрана. Никаких пробросов пропсов — любой код вызывает `showToast(text)`.

**Флоу.**
1. Любой код (сейчас — кнопка временного чата) вызывает `showToast("текст")`.
2. Стор кладёт текст и инкрементит `toastKey` — ключ нужен, чтобы перезапустить анимацию даже для одинакового текста подряд.
3. `Toast` (смонтирован один раз в `chat.tsx`) видит новый ключ → fade-in, таймер 2s → fade-out. Повторный вызов перезапускает таймер.
4. `pointerEvents="none"` — тост не перехватывает касания, под ним можно продолжать работать.

**Код** (`toast-store.ts`, `Toast.tsx`, подключение):

```ts
// стор + триггер
type ToastState = { text: string | null; toastKey: number };
export const useToastStore = create<ToastState>(() => ({
  text: null,
  toastKey: 0,
}));

export const showToast = (text: string) =>
  useToastStore.setState((s) => ({ text, toastKey: s.toastKey + 1 }));
```

```tsx
// компонент: реакция на новый ключ
const text = useToastStore((s) => s.text);
const toastKey = useToastStore((s) => s.toastKey);

useEffect(() => {
  if (!text) return;
  opacity.value = withTiming(1);           // fade-in
  const timer = setTimeout(() => {
    opacity.value = withTiming(0);         // fade-out через 2s
  }, 2000);
  return () => clearTimeout(timer);
}, [toastKey, text]);
```

```tsx
// chat.tsx — монтируется один раз на весь чат-скрин
<SidebarHandler ... />
<Toast />
```

## 9. Гигиена стора

`deleteChat` гасит `pendingRenameChatId`, если удалили чат, на который висел сигнал — иначе сигнал оставался бы висеть на несуществующий id (безвредно, но грязно).

## 10. Фикс «Cannot add new property '_tracking'»

**Что делает.** `useKeyboardInset.ts` создаёт `Animated.Value` через `useState(() => new Animated.Value(0))`. React Compiler (включён в проекте) мемоизирует это значение и делает объект non-extensible — RN Animated при первом же `Animated.timing` пытается навесить внутреннее свойство `_tracking` и падает.

**Флоу.**
1. Экран чата монтируется → компилятор закешировал `Animated.Value`.
2. Пользователь открывает клавиатуру → `Keyboard.addListener` → `Animated.timing(inset, ...).start()` → внутри `track()` присваивает `this._tracking` → throw.

**Код** — escape-hatch компилятора в начале файла:

```ts
// React Compiler мемоизирует Animated.Value из useState и делает его
// non-extensible — RN Animated падает с «Cannot add new property
// '_tracking'» при первом же Animated.timing. Отключаем мемоизацию
// для этого файла целиком: он крошечный, мемоизация ничего не дает.
'use no memo';
```
