---

**Дата:** 10.11.2026
**Теги:** #features #chat #drafts #i18n #refactor #ui

---

## 1. Зачем

Поле ввода чата (`ChatInputArea`) монтировалось только когда чат уже создан
и выбран — на пустой странице чата ввода не было вообще, написать первое
сообщение было невозможно. Черновик хранился в колонке `draft` таблицы
`chats` в SQLite — то есть временное состояние набора текста жило в
постоянном хранилище (аналог localStorage, хотя по смыслу это sessionStorage).
На телефоне клавиатура перекрывала поле ввода — было непонятно, что пишешь.
Длинный текст в input и длинный список чатов в сайдбаре скроллились без
какого-либо индикатора — не видно, сколько контента скрыто. `ChatItemPopover`
был одним монолитным файлом со всеми тремя режимами (menu / rename / delete).
Локаль вычислялась на каждом рендере провайдера из системных настроек —
без приоритетов и без места под будущий выбор юзера.

## 2. Где/что уже было

Переиспользовано почти всё, нового кода минимум:

- **zustand-стор `useChatsStore`** (`src/features/chats/model/chats-store.ts`)
  — уже был единственным источником состояния чатов, включая
  `activeChatId` и `focusChatId`. Драфты просто добавлены в него.
- **Хук `useChatDraft`** — уже существовал как слой между input и хранилищем,
  поменялся только бэкенд драфта (БД → память).
- **`PopoverMenu`** (`src/shared/components/ui/PopoverMenu`) — готовая
  оболочка popover'а, разнос режимов её не тронул.
- **Репозиторий `chats-repository.ts`** — CRUD-функции остались, из них
  только удалена `updateDraft`.
- **Механизм миграций** (`PRAGMA user_version` + `openDb`) — новая миграция
  v2 вписалась в существующий пайплайн без изменений инфраструктуры.
- **`createTranslator` / `useT`** — слой переводов не менялся, поменялся
  только источник локали.

Задача была не писать новое, а перекомпоновать существующее: стор уже
умел всё, кроме драфтов; мигратор уже умел версионирование.

## 3. Реализация

### 3.1 Драфты: БД → память (сессионное состояние)

Ключевое архитектурное решение: черновик — это **сессионное состояние**
(аналог sessionStorage на вебе), а не данные. Переживает переключение
чатов и вкладок, стирается при рестарте приложения. Ловить «закрытие
приложения» событиями ненадежно (особенно на web) — память стора стирается
автоматически и гарантированно.

В сторе два поля:

```ts
// src/features/chats/model/chats-store.types.ts
  /**
   * Черновики в памяти (сессионное состояние, аналог sessionStorage):
   * переживают переключение чатов и вкладок, стираются при рестарте.
   */
  drafts: Record<string, string>;
  /** Черновик временного чата (когда активный чат не выбран) */
  globalDraft: string;
```

Экшены стора — чистая запись в память, никаких промисов:

```ts
// src/features/chats/model/chats-store.ts
  setDraft: (id, draft) =>
    set((state) => ({ drafts: { ...state.drafts, [id]: draft } })),

  setGlobalDraft: (draft) => set({ globalDraft: draft }),
```

Два места очистки драфтов:

```ts
// src/features/chats/model/chats-store.ts — createChat
    set((state) => ({
      chats: [chat, ...state.chats],
      activeChatId: chat.id,
      focusChatId: chat.id,
      // Черновик временного чата переезжать в новый чат не должен:
      // временный чат после создания реального недоступен
      globalDraft: '',
    })),

// src/features/chats/model/chats-store.ts — deleteChat
    set((state) => {
      const drafts = { ...state.drafts };
      delete drafts[id];
      return { chats: ..., drafts, activeChatId: ... };
    });
```

Хук `useChatDraft` — единственная точка, через которую UI работает
с драфтом. Принимает `chatId: string | null`; `null` = временный чат,
текст идет в `globalDraft`:

```ts
// src/features/chats/model/use-chat-draft.ts
export function useChatDraft(chatId: string | null) {
  const draft = useChatsStore((state) =>
    chatId === null
      ? state.globalDraft
      : (state.drafts[chatId] ?? ''),
  );
  const setDraft = useChatsStore((state) => state.setDraft);
  const setGlobalDraft = useChatsStore((state) => state.setGlobalDraft);

  const handleChange = useCallback(
    (text: string) => {
      if (chatId === null) {
        setGlobalDraft(text);
      } else {
        setDraft(chatId, text);
      }
    },
    [chatId, setDraft, setGlobalDraft],
  );

  return { draft, handleChange };
}
```

### 3.2 Миграция v2: снос колонки `draft`

`DB_SCHEMA_VERSION` поднят до 2, миграция идемпотентна — проверяет наличие
колонки через `PRAGMA table_info` (свежие БД создаются сразу без `draft`):

```ts
// src/lib/db/migrations.ts
  // v2: колонка draft удалена — черновики это сессионное состояние
  // (аналог sessionStorage), они переехали в память стора
  if (current < 2) {
    const columns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(chats)',
    );

    if (columns.some((column) => column.name === 'draft')) {
      await db.execAsync('ALTER TABLE chats DROP COLUMN draft;');
    }
  }
```

Из типов (`src/types/chat.ts`) удалены `draft` из `ChatRecord` и `ChatRow`,
из репозитория — функция `updateDraft` и её экспорт в `src/lib/db/index.ts`.
`createChat` больше не пишет `draft` при INSERT.

### 3.3 Временный чат = `activeChatId: null`

Отдельной сущности «временный чат» в БД нет — это просто состояние
«ничего не выбрано». Свойства:

- при загрузке приложения выбор всегда сброшен (стор в памяти,
  `activeChatId: null` — перезагрузка гарантированно открывает временный чат);
- ввод идет в `globalDraft`;
- при создании реального чата (`createChat`) глобальный драфт стирается,
  вернуться к временному чату невозможно — его нет в списке, «назад»
  ведет в тот же стейт «ничего не выбрано».

### 3.4 Input всегда виден

`ChatContent` рендерит `ChatInputArea` безусловно, вне ветки
«выбран/не выбран». Убран `key={activeChat.id}` — из-за него компонент
пересоздавался на каждый чат, а без активного чата не монтировался вовсе:

```tsx
// src/app/(tabs)/chat/components/ChatContent/ChatContent.tsx
      <View className="flex-1">
        {activeChat ? (
          <>
            {/* центрированный заголовок чата (54px отступы по бокам) */}
            <View className="flex-row items-center px-4" style={{ height: 54 }}>
              <View style={{ width: 54 }} />
              <Text numberOfLines={1} className="flex-1 text-center ...">
                {activeChat.title}
              </Text>
              <View style={{ width: 54 }} />
            </View>
            {/* TODO: здесь будет список сообщений активного чата */}
          </>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-2xl ...">
              {t("chatInput.emptyTitle")}
            </Text>
            <Text className="pt-2 text-center text-sm text-text-muted">
              {t("chatInput.subtitle")}
            </Text>
          </View>
        )}
      </View>

      <ChatInputArea chatId={activeChat?.id ?? null} />
```

`ChatInputArea` принимает `chatId: string | null` вместо объекта чата —
драфт читается из стора по id, пересоздание компонента не нужно.
Механизм автофокуса после создания чата сохранен (`focusChatId` /
`consumeFocusChat`).

### 3.5 Клавиатура

```tsx
// src/app/(tabs)/chat/components/ChatContent/ChatContent.tsx
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
      style={{ paddingTop: topInset }}
    >
```

- **iOS**: `behavior="padding"` — плавный подъем ввода над клавиатурой
  и плавное опускание при выходе из режима печати (анимация из коробки).
- **Android**: в `app.json` добавлен `"softwareKeyboardLayoutMode": "resize"`
  — система сама ресайзит окно.
- **web**: клавиатура не оверлей, ничего не нужно.

### 3.6 ScrollIndicator — общий UI-компонент

Новый переиспользуемый компонент в `src/shared/components/ui/ScrollIndicator/`
(4 файла: компонент, хук, конфиг, типы). Хук считает математику тумбы
по трем метрикам — размер вьюпорта, высота контента, смещение:

```ts
// src/shared/components/ui/ScrollIndicator/useScrollIndicator.ts
  const isOverflow = contentHeight > viewportHeight + OVERFLOW_EPSILON;

  const thumbHeight = isOverflow
    ? Math.max(
        THUMB_MIN_HEIGHT,
        (viewportHeight / contentHeight) * viewportHeight,
      )
    : 0;

  const maxScroll = Math.max(1, contentHeight - viewportHeight);
  const progress = Math.min(1, Math.max(0, offsetY / maxScroll));
  const thumbTop = isOverflow
    ? progress * (viewportHeight - thumbHeight)
    : 0;

  return {
    isVisible: isOverflow,
    thumbHeight,
    thumbTop,
    onScroll,            // NativeSyntheticEvent<ScrollMetrics>
    onContentSizeChange, // { nativeEvent: { contentSize } } — единый формат
    onLayout,            // LayoutChangeEvent
  };
```

Компонент — тонкая закругленная полоска (3px, `THUMB_COLOR`), рендерится
только при переполнении, `pointerEvents="none"` и скрыт от accessibility:

```tsx
// src/shared/components/ui/ScrollIndicator/ScrollIndicator.tsx
export function ScrollIndicator({
  isVisible, thumbHeight, thumbTop, side = 'right', inset = 2,
}: ScrollIndicatorProps) {
  if (!isVisible || thumbHeight <= 0) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        [side]: inset,
        top: thumbTop,
        width: THUMB_WIDTH,
        height: thumbHeight,
        borderRadius: THUMB_WIDTH / 2,
        backgroundColor: THUMB_COLOR,
      }}
    />
  );
}
```

Подключен в двух местах:

- **ChatInputArea** — `side="left"`, внутри relative-обертки TextInput.
  Источники метрик: `onScroll` + `onContentSizeChange` + `onLayout`
  самого `TextInput`. Соотношения input'а не менялись.
- **ChatSidebar** (`SectionList`) — `side="right"`, нативный индикатор
  отключен (`showsVerticalScrollIndicator={false}`). У списков
  `onContentSizeChange` имеет сигнатуру `(width, height)`, поэтому
  используется адаптер:

```tsx
// src/app/(tabs)/chat/components/ChatSidebar/ChatSidebar.tsx
          onScroll={scroll.onScroll}
          onContentSizeChange={(width, height) =>
            scroll.onContentSizeChange({
              nativeEvent: { contentSize: { width, height } },
            })
          }
          onLayout={scroll.onLayout}
```

### 3.7 ChatItemPopover: разнос на 3 компонента + конфиг

Монолит разбит без изменения логики. Общая оболочка рендерит `PopoverMenu`
и подставляет UI режима из конфиг-мапы:

```tsx
// src/app/(tabs)/chat/components/ChatSidebar/ChatListItem/ChatItemPopover.config.tsx
/** Конфиг popover'а чата: какой UI рендерить для какого режима */
export const CHAT_POPOVER_CONTENT: Record<
  ChatPopoverMode,
  ComponentType<ChatPopoverContentProps>
> = {
  menu: ChatPopoverMenu,
  rename: ChatPopoverRename,
  delete: ChatPopoverDelete,
};
```

```tsx
// src/app/(tabs)/chat/components/ChatSidebar/ChatListItem/ChatItemPopover.tsx
  /** Закрытие со сбросом режима в menu */
  const close = () => {
    onModeChange("menu");
    onClose();
  };

  const Content = CHAT_POPOVER_CONTENT[mode];

  return (
    <PopoverMenu open={open} onClose={close} anchor={anchor} width={CHAT_POPOVER_WIDTH}>
      <Content
        chat={chat}
        close={close}
        onModeChange={onModeChange}
        onRename={onRename}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    </PopoverMenu>
  );
```

Каждый режим — отдельный файл с единым контрактом пропсов
(`ChatPopoverContentProps` в `ChatItemPopover.types.ts`; туда же вынесен
`MenuItemProps`, который использует `ChatPopoverMenu`):

- `ChatPopoverMenu.tsx` — список действий (переименовать / закрепить /
  удалить), навигация по режимам через `onModeChange`;
- `ChatPopoverRename.tsx` — инпут переименования;
- `ChatPopoverDelete.tsx` — подтверждение удаления.

Добавление нового режима = новый компонент + одна строка в конфиг.

### 3.8 i18n: глобальное вычисление локали

Новый стор `locale-store` — локаль вычисляется **один раз при загрузке
приложения**, глобально, вне React. Приоритетная цепочка с местом под
будущий выбор юзера:

```ts
// src/shared/i18n/locale-store.ts
/**
 * Вычисляет локаль один раз при загрузке приложения. Приоритеты:
 *
 * 1. TODO(i18n): выбор юзера — когда появится переключатель языка,
 *    читать здесь сохраненный выбор (персистентное хранилище) и
 *    возвращать его до системного определения.
 * 2. Системная локаль устройства.
 * 3. Дефолтная локаль приложения.
 */
function resolveLocale(): Locale {
  const languageTag = getLocales()[0]?.languageTag ?? '';
  const base = languageTag.split('-')[0];

  if ((locales as readonly string[]).includes(base)) {
    return base as Locale;
  }

  return defaultLocale;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: resolveLocale(),
  /** Для будущего переключателя языка в настройках */
  setLocale: (locale) => set({ locale }),
}));
```

Провайдер стал stateful — подписан на стор, переводчик пересоздается
только при смене локали:

```tsx
// src/shared/i18n/I18nProvider.tsx
export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useLocaleStore((state) => state.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
```

Когда появится переключатель языка — достаточно вписать чтение
сохраненного выбора в начало `resolveLocale()` (или вызывать
`setLocale` из настроек), остальная цепочка уже готова.

## 4. UI

Измененные/новые компоненты:

- `ChatContent` (`src/app/(tabs)/chat/components/ChatContent/`) — обернут
  в `KeyboardAvoidingView`, ввод рендерится всегда, empty-state по центру
  для временного чата.
- `ChatInputArea` — проп `chatId: string | null`, индикатор прокрутки
  слева внутри «пузыря», кнопка отправки визуальная (disabled — отправка
  не входит в эту итерацию).
- `ScrollIndicator` (`src/shared/components/ui/ScrollIndicator/`) — новый
  общий компонент, встроен в input (слева) и сайдбар (справа).
- `ChatItemPopover` — оболочка; `ChatPopoverMenu` / `ChatPopoverRename` /
  `ChatPopoverDelete` — UI режимов; `ChatItemPopover.config.tsx` — мапа
  режим → компонент.

Остальная логика (создание/переименование/удаление/закрепление чатов,
сортировка, группировка по дням) не тронута.

## 5. Поток данных

Набор текста (временный чат):

```
Печать в TextInput
↓ onChangeText → useChatDraft.handleChange(text)
↓ chatId === null → setGlobalDraft(text) → zustand: globalDraft
↓ селектор стора → draft в TextInput (controlled)
```

Набор текста (выбранный чат):

```
Печать в TextInput
↓ onChangeText → useChatDraft.handleChange(text)
↓ setDraft(chatId, text) → zustand: drafts[chatId]
↓ селектор стора → draft в TextInput
↓ переключение на другой чат → chatId меняется → читается drafts[другой id]
```

Создание чата из временного:

```
createChat(title)
↓ chatsRepository.createChat → INSERT в SQLite
↓ set: chats + activeChatId + focusChatId, globalDraft: '' (временный недоступен)
↓ ChatInputArea: focusChatId === chatId → consumeFocusChat → input.focus()
```

Удаление чата:

```
ChatPopoverDelete → onDelete(id)
↓ chatsStore.deleteChat(id)
↓ chatsRepository.deleteChat → DELETE FROM chats (CASCADE messages)
↓ set: chats без чата, drafts без drafts[id], activeChatId → null
↓ ChatContent: activeChat === undefined → empty-state, ввод в globalDraft
```

Скролл-индикатор:

```
Монтаж/контент изменился
↓ onLayout → viewportHeight; onContentSizeChange → contentHeight
↓ isOverflow = contentHeight > viewport + EPSILON
↓ скролл: onScroll → offsetY → progress → thumbTop
↓ ScrollIndicator: absolute-полоска на позиции thumbTop
```

Смена локали (будущее):

```
Переключатель языка → setLocale(locale)
↓ zustand: locale
↓ I18nProvider: t = createTranslator(locale) (useMemo)
↓ все useT() перерисовываются с новым словарем
```

## 6. Почему так, а не иначе

1. **Драфты в памяти стора, а не в БД с флагом «очистить при выходе».**
   Ловить закрытие приложения событиями ненадежно (на web `beforeunload`
   не гарантирован, на нативе события завершения приходят не всегда).
   Память процесса стирается сама — гарантия «бесплатно». Пользователь
   явно подтвердил аналогию: sessionStorage, а не localStorage.
2. **Временный чат = `activeChatId: null`, а не временная запись в БД.**
   Временной чат не должен появляться в списке, переживать рестарт или
   участвовать в запросах — отдельная сущность дала бы все эти проблемы.
   `null` уже был валидным состоянием стора, семантика просто уточнена.
3. **Один общий `ScrollIndicator`, а не два локальных.** Математика тумбы
   (пропорции, epsilon, min-height) одинакова для input и списка; разница
   только в стороне и источнике событий. Хук принимает единый формат
   `onContentSizeChange`, адаптер для списков — одна обертка на месте.
4. **Конфиг-мапа режимов popover'а, а не switch внутри компонента.**
   Мапа `Record<Mode, ComponentType>` типобезопасна (компилятор следит,
   что каждый режим покрыт) и расширяется добавлением строки, без правки
   императивной логики рендера.
5. **Локаль в zustand-сторе, а не вычисление в провайдере на каждый рендер.**
   `getLocales()` — синхронный нативный вызов; вычисление один раз при
   старте дешевле и дает точку переопределения (`setLocale`) для будущего
   переключателя без переделки провайдера.

## Преимущества

- ✅ Ввод виден всегда — первое сообщение можно написать на пустой странице
- ✅ Драфты переживают переключение чатов и вкладок, гарантированно стираются при рестарте
- ✅ Временное состояние больше не попадает в постоянное хранилище (БД чище)
- ✅ Клавиатура не перекрывает ввод: плавный подъем на iOS, resize на Android
- ✅ Индикаторы прокрутки в input и сайдбаре из одного переиспользуемого компонента
- ✅ Popover разделен на режимы — новый режим добавляется одной строкой в конфиг
- ✅ Локаль вычисляется глобально один раз, место под выбор юзера уже готово (TODO)
- ✅ Миграция v2 идемпотентна — свежие и старые БД приходят к одной схеме
