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
2. Новый элемент появляется в `FlatList` асинхронно — позже самого сигнала. Сигнал лежит в сторе и «догоняет» э��емент: когда тот смонтируется, первое же сравнение даёт совпадение.
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

**Что делает.** Инсет клавиатуры — это `Animated.Value` из **react-native**, и он должен попадать только в `Animated.View` тоже из react-native. Когда добавлялся cross-fade, импорт `Animated` в `ChatContent` незаметно поменялся на reanimated — и внешний контейнер стал reanimated-овским. Reanimated не поддерживает RN `Animated.Value` в стилях: объект инсета оказывается замороженным, и при первом же `Animated.timing` (показ клавиатуры) RN Animated падает с «Cannot add new property '_tracking'».

**Флоу.**
1. `ChatContent` рендерится с reanimated-контейнером, в style передан RN `Animated.Value` инсета.
2. Пользователь открывает клавиатуру → `Keyboard.addListener` → `Animated.timing(inset, ...).start()` → внутри `track()` присваивает `this._tracking` → throw.

**Код** — два независимых Animated в одном файле:

```tsx
import { Animated as RNAnimated } from "react-native";           // для инсета
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated"; // для cross-fade

// Внешний контейнер — RN Animated.View (принимает Animated.Value в style)
<RNAnimated.View style={{ paddingBottom: keyboardInset }}>
  {/* Внутренний слой — reanimated, cross-fade */}
  <Animated.View key={activeChat?.id ?? "temp"} entering={FadeInDown.duration(200)}>
    ...
  </Animated.View>
</RNAnimated.View>
```

Директива `'use no memo'` в `useKeyboardInset.ts` оставлена как страховка от React Compiler (он тоже может заморозить `Animated.Value`), но реальная причина была в смешивании библиотек.

## 11. Плавный ScrollIndicator (без ре-рендеров при скролле)

**Что делает.** Раньше каждый scroll-событие делало `setOffsetY` → ре-рендер всего `SidebarContent` (тяжёлый компонент со списками) → тумба двигалась рывками и отставала от прокрутки. Теперь смещение/размеры живут в reanimated shared values, позиция тумбы считается в worklet'е на UI-потоке — скролл не вызывает ни одного ре-рендера.

**Флоу.**
1. Скролл → `onScroll` пишет `offsetY.value` (JS-поток, throttle 16ms) — React не узнаёт об этом вообще.
2. `useAnimatedStyle` на UI-потоке пересчитывает `top`/`height`/`opacity` тумбы из shared values.
3. `ScrollIndicator` рендерит `Animated.View` с этим стилем — компонент статичен, ре-рендерится только при смене layout.

**Код** — хук:

```ts
const offsetY = useSharedValue(0);
const viewportHeight = useSharedValue(0);
const contentHeight = useSharedValue(0);

// обычный колбэк (работает и для SectionList/FlatList, и для TextInput,
// которым reanimated-обработчик не передать) — пишет в shared value
const onScroll = (event) => {
  offsetY.value = event.nativeEvent.contentOffset.y;
};

// позиция тумбы — worklet на UI-потоке, без React
const thumbStyle = useAnimatedStyle(() => {
  const isOverflow = contentHeight.value > viewportHeight.value + OVERFLOW_EPSILON;
  const progress = Math.min(1, Math.max(0, offsetY.value / maxScroll));
  return {
    opacity: isOverflow ? 1 : 0,
    top: verticalPadding + progress * (trackHeight - thumbHeight),
    height: thumbHeight,
  };
});
```

Компонент и потребители:

```tsx
// ScrollIndicator: статичный Animated.View, стиль приходит анимированным
<ScrollIndicator style={scroll.thumbStyle} side="right" inset={-6} />

// ChatSidebar: списки остались обычными (SectionList/FlatList),
// изменился только источник стиля у индикатора
<ScrollIndicator style={scroll.thumbStyle} ... />
```

Замечание: reanimated 4.5.1 не экспортирует `Animated.SectionList`, а `Animated.FlatList` не принимает `scrollHandler` — поэтому подписка через обычный `onScroll` с записью в shared value, а не `useAnimatedScrollHandler`. Отрисовка всё равно на UI-потоке, рывков нет.
