---

**Дата:** 14.10.2026
**Теги:** #refactoring #chats-search #ui-animations

---

# Рефакторинг поиска по чатам

## Обзор изменений

- Логика popover'а элемента чата вынесена из `ChatListItem` в хук `useChatPopover`.
- Хендлеры сайдбара (секции, сброс поиска, выбор/создание чата, сортировка) вынесены в хуки рядом с `useChatSidebar`.
- Переключение обычного списка и результатов поиска переделано: один общий `FadeIn`/`FadeOut` на весь список вместо рассинхронизированных пер-элементных анимаций.
- `mergeSearchResults` приоритизирует результаты: чаты, найденные обоими этапами, идут первыми.
- Добавлен `.env.example` с ключом OpenRouter для эмбедингов.

---

## Часть 1: Popover элемента чата

### Проблема(ы)

**Проблема 1:** `ChatListItem` держал у себя 4 состояния (открыт/режим popover'а, hover, якорь) и ручки `openPopover`/`closePopover`/`setMode` — компонент занимался не рендером, а оркестрацией.

### Решения

#### 1.1. Хук `useChatPopover`

**Файл:** `src/app/(tabs)/chat/components/ChatSidebar/ChatListItem/useChatPopover.ts`

```ts
// src/app/(tabs)/chat/components/ChatSidebar/ChatListItem/useChatPopover.ts
export function useChatPopover() {
  const { anchorRef, anchor, measure } = usePopoverAnchor();

  const [popover, setPopover] = useState(INITIAL_POPOVER);
  const [isHovered, setIsHovered] = useState(false);

  const openPopover = useCallback(
    (mode: ChatPopoverMode) => {
      measure();
      setPopover({ open: true, mode });
    },
    [measure],
  );

  const closePopover = useCallback(() => setPopover(INITIAL_POPOVER), []);

  const setMode = useCallback(
    (mode: ChatPopoverMode) => setPopover((prev) => ({ ...prev, mode })),
    [],
  );

  const hoverHandlers = {
    onHoverIn: () => setIsHovered(true),
    onHoverOut: () => setIsHovered(false),
  };

  /** На web кнопка меню видна на hover или при открытом popover'е */
  const showDots = Platform.OS === "web" ? isHovered || popover.open : true;

  return { anchorRef, anchor, hoverHandlers, popover, openPopover, closePopover, setMode, showDots };
}
```

**Логика:** хук инкапсулирует всё состояние popover'а: якорь из `usePopoverAnchor`, режим (`menu`/`rename`), hover. `showDots` — платформенная логика видимости кнопки меню (на web — по hover или открытому popover'у, на нативе — всегда) тоже живет здесь. `ChatListItem.tsx` теперь только подключает ручки, включая `{...hoverHandlers}` на `Pressable`, и стал чистым presentational-компонентом.

---

## Часть 2: Хендлеры сайдбара

### Проблема(ы)

**Проблема 1:** в `SidebarContent` вперемешку жили данные, мемоизация группировки и все обработчики — компонент разросся и смешивал уровни абстракции.

### Решения

#### 2.1. Три хука в `ChatSidebar.hooks.ts` (рядом с существующим `useChatSidebar`)

**Файл:** `src/app/(tabs)/chat/components/ChatSidebar/ChatSidebar.hooks.ts`

```ts
// src/app/(tabs)/chat/components/ChatSidebar/ChatSidebar.hooks.ts
/** Секции сгруппированного списка + число закрепленных (сигнал перерисовки) */
export function useChatSections(chats: ChatRecord[], sortDirection: SortDirection) {
  const { locale } = useLocaleContext();
  const t = useT();

  const pinnedCount = useMemo(
    () => chats.filter((chat) => chat.isPinned).length,
    [chats],
  );

  const sections = useMemo(
    () => groupChatsByDay(chats, sortDirection, locale, t("chats.pinned")),
    [chats, sortDirection, locale, t],
  );

  return { sections, pinnedCount };
}

export function useSearchResetOnClose(isOpen: boolean, resetSearch: () => void) {
  useEffect(() => {
    if (!isOpen) resetSearch();
  }, [isOpen, resetSearch]);
}

export function useSidebarHandlers(onClose, resetSearch) {
  // handleSelectChat: setActiveChat + resetSearch + onClose
  // handleCreateChat: createChat + onClose
  // handleToggleSort: переключение newest/oldest
}
```

**Логика:** `useChatSections` мемоизирует группировку по дням и отдает `pinnedCount` — он нужен как часть key анимации (см. Часть 3). `useSearchResetOnClose` сбрасывает поиск при закрытии панели, чтобы при следующем открытии показывался обычный список. `useSidebarHandlers` собирает три обработчика; выбор чата тоже сбрасывает поиск — инвариант «сайдбар открыт → список обычный» соблюдается в обоих сценариях. `SidebarContent` остался только композицией.

---

## Часть 3: Анимация переключения списков

### Проблема(ы)

**Проблема 1:** `SectionList` и `FlatList` размонтировались по отдельности с пер-элементными `entering`/`exiting` — элементы и заголовки групп исчезали вразнобой, переход выглядел рваным.

### Решения

#### 3.1. Один анимируемый контейнер на весь список

**Файл:** `src/app/(tabs)/chat/components/ChatSidebar/ChatSidebar.tsx`

```tsx
// src/app/(tabs)/chat/components/ChatSidebar/ChatSidebar.tsx
{/* Список целиком проявляется/растворяется одним блоком:
    чаты и заголовки групп исчезают одновременно */}
<Animated.View
  key={`${isSearchActive}:${sortDirection}:${pinnedCount}`}
  entering={FadeIn.duration(200)}
  exiting={FadeOut.duration(150)}
  className="flex-1"
>
  {!isSearchActive ? <SectionList ... /> : <FlatList ... />}
</Animated.View>
```

**Логика:** оба списка обёрнуты в один `Animated.View` с единственной парой `FadeIn`/`FadeOut` — список целиком растворяется и проявляется одним блоком. `key` включает `isSearchActive`, `sortDirection` и `pinnedCount`: смена любого из них перемонтирует контейнер и запускает анимацию заново. Пер-элементные entering/exiting убраны, остался `LinearTransition` для плавных перестановок внутри списка. `ScrollIndicator` вынесен за пределы анимируемого блока, чтобы не мигал вместе со списком.

---

## Часть 4: Приоритизация merge результатов

### Проблема(ы)

**Проблема 1:** `mergeSearchResults` возвращал чаты в порядке этапа поиска — чат, подтвержденный и keyword-поиском, и эмбеддингами, мог оказаться ниже чата, найденного только эмбеддингами.

### Решения

#### 4.1. Группы `both → keyword-only → embedding-only`

**Файл:** `src/features/chats/lib/merge-search-results.ts`

```ts
// src/features/chats/lib/merge-search-results.ts
export function mergeSearchResults(
  keywordResults: ChatSearchResult[],
  embeddingResults: ChatSearchResult[],
): ChatSearchResult[] {
  const embeddingById = new Map(embeddingResults.map((r) => [r.chat.id, r]));
  const keywordIds = new Set(keywordResults.map((r) => r.chat.id));

  const both: ChatSearchResult[] = [];
  const keywordOnly: ChatSearchResult[] = [];

  for (const result of keywordResults) {
    const embedding = embeddingById.get(result.chat.id);
    if (!embedding) {
      keywordOnly.push(result);
      continue;
    }
    both.push({ ...result, sources: [...result.sources, ...embedding.sources] });
  }

  const embeddingOnly = embeddingResults.filter((r) => !keywordIds.has(r.chat.id));

  return [...both, ...keywordOnly, ...embeddingOnly];
}
```

**Логика:** результат разбивается на три группы: `keyword + embedding` → `keyword-only` → `embedding-only`. Внутри групп сохраняется порядок релевантности этапа (keyword — порядок из репозитория, embedding — порядок KNN по similarity). У чата из обеих групп объединяются `sources` и сохраняется подсветка keyword-результата. O(n) через два `Map`/`Set` вместо вложенных переборов.

---

## Часть 5: Конфигурация эмбедингов

### Проблема(ы)

**Проблема 1:** ключ OpenRouter нигде не был задокументирован — при развертывании легко пропустить `EXPO_PUBLIC_OPENROUTER_API_KEY`.

### Решения

#### 5.1. `.env.example`

**Файл:** `.env.example`

```bash
# .env.example
# Ключ OpenRouter для эмбедингов (модель nvidia/nemotron-3-embed-1b:free)
EXPO_PUBLIC_OPENROUTER_API_KEY=
```

**Логика:** модель `nvidia/nemotron-3-embed-1b:free` уже была единственной в `embeddings.config.ts` (фолбэков и других упоминаний по `src/` нет), поэтому код не менялся — добавлен только пример env-файла.

---

## Итоги

### Изменённые файлы (6 шт)

**Декомпозиция UI:**
1. `src/app/(tabs)/chat/components/ChatSidebar/ChatListItem/useChatPopover.ts` — новый хук: состояние/якорь/hover popover'а.
2. `src/app/(tabs)/chat/components/ChatSidebar/ChatListItem/ChatListItem.tsx` — подключает `useChatPopover`, стал presentational.
3. `src/app/(tabs)/chat/components/ChatSidebar/ChatSidebar.hooks.ts` — добавлены `useChatSections`, `useSearchResetOnClose`, `useSidebarHandlers`.
4. `src/app/(tabs)/chat/components/ChatSidebar/ChatSidebar.tsx` — `SidebarContent` на хуках, единая анимация переключения списков.

**Логика поиска:**
5. `src/features/chats/lib/merge-search-results.ts` — приоритизация `both → keyword-only → embedding-only`.

**Конфигурация:**
6. `.env.example` — документирован `EXPO_PUBLIC_OPENROUTER_API_KEY`.

### Результаты

- ✅ `ChatListItem` — чистый presentational-компонент, вся логика popover'а в хуке.
- ✅ `SidebarContent` — только композиция, хендлеры переиспользуются через хуки.
- ✅ Переход обычный список ↔ результаты поиска — один плавный fade всего блока, без рассинхрона.
- ✅ Релевантные чаты (найденные обоими этапами) всегда вверху выдачи.
- ✅ `tsc --noEmit` чисто; `expo lint` — только предсуществующие ошибки в `SwitchGlobal.hooks.ts`.

---

## Принципы, использованные при рефакторинге

- **Surgical Changes** — точечные изменения без переписывания рабочего кода: модель эмбедингов не тронута, т.к. уже была в целевом состоянии.
- **Extract Hook** — состояние и хендлеры переезжают в хуки рядом с компонентом, а не в отдельные файлы-оркестраторы.
- **Single Animation Container** — анимация перехода на уровне контейнера, а не элементов, когда элементы должны исчезать согласованно.
