---

**Дата:** 11.10.2026
**Теги:** #features #chat #sidebar #ui

---

## 1. Зачем

Страница чата нуждалась в панели для взаимодействия со списком чатов: создание нового чата, поиск по истории, переключение между диалогами. Без панели пользователь не мог быстро переключаться между чатами или начать новый диалог. Панель должна работать одинаково на мобильных (с затемнением фона) и десктопе (без затемнения), всегда открываясь поверх контента без сдвига основной страницы.

## 2. Где/что уже было

Панель размещена локально в `src/app/(tabs)/chat/` — это не shared-компонент, а часть конкретной страницы. Архитектурное решение: страница чата отвечает за композицию своих компонентов.

Используется существующая инфраструктура:
- `react-native-reanimated` для плавной анимации выезда панели слева
- `useSafeAreaInsets()` для учёта safe area (вырезы экрана)
- `colors` из `@/shared/config/colors` — централизованная палитра
- Принцип Single Responsibility: страница только композирует компоненты, не содержит визуальной разметки

```tsx
// src/app/(tabs)/chat.tsx
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const sidebar = useChatSidebar();

  return (
    <View className="flex-1 bg-background">
      <ChatContent topInset={insets.top} />
      <SidebarHandler
        isOpen={sidebar.isOpen}
        onClose={sidebar.close}
        onToggle={sidebar.toggle}
        isDesktop={sidebar.isDesktop}
        sidebarWidth={sidebar.sidebarWidth}
        topInset={insets.top}
      />
    </View>
  );
}
```

## 3. Реализация

### Структура компонентов

```
src/app/(tabs)/chat/
  chat.tsx                              — композиция страницы
  components/
    ChatContent/                        — контент страницы
      ChatContent.tsx
      ChatContent.types.ts
      
    SidebarHandler/                     — управление sidebar
      SidebarHandler.tsx
      SidebarHandler.types.ts
      
    ChatSidebar/                        — компоненты панели
      ChatSidebar.tsx                   — основная панель
      ChatSidebar.hooks.ts              — useChatSidebar
      ChatSidebar.config.ts             — константы
      ChatSidebar.types.ts              — типы
      ChatSidebarTrigger.tsx            — кнопка открытия
      index.ts
```

### Ключевые функции

**`useChatSidebar()`** — управление состоянием панели:
- Принимает: ничего
- Возвращает: `{ isOpen, isDesktop, sidebarWidth, open, close, toggle }`
- Вычисляет ширину панели: desktop = 280px, mobile = 70% ширины экрана (мин 240px)
- Определяет режим: desktop при ширине ≥900px

```ts
// src/app/(tabs)/chat/components/ChatSidebar/ChatSidebar.hooks.ts
export function useChatSidebar(): ChatSidebarController {
  const { width } = useWindowDimensions();
  const isDesktop = width >= SIDEBAR_DESKTOP_BREAKPOINT;
  const [isOpen, setIsOpen] = useState(isDesktop);

  const sidebarWidth = isDesktop
    ? SIDEBAR_DESKTOP_WIDTH
    : Math.max(Math.round(width * SIDEBAR_MOBILE_RATIO), SIDEBAR_MOBILE_MIN_WIDTH);

  return { isOpen, isDesktop, sidebarWidth, open, close, toggle };
}
```

**`ChatSidebar`** — рендер панели:
- Принимает: `{ isOpen, onClose, isDesktop, sidebarWidth }`
- Возвращает: анимированную панель + backdrop (только mobile)
- Анимация: `translateX` от `-sidebarWidth` до `0` за 260мс
- Содержит `SidebarContent` — заглушку под будущий функционал (поиск, список чатов)

```tsx
// src/app/(tabs)/chat/components/ChatSidebar/ChatSidebar.tsx
export function ChatSidebar({ isOpen, onClose, isDesktop, sidebarWidth }: ChatSidebarProps) {
  const progress = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: ANIMATION_DURATION,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [isOpen, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-sidebarWidth, 0]) }],
  }));

  return (
    <>
      {!isDesktop && <Animated.View style={backdropStyle}><Pressable onPress={onClose} /></Animated.View>}
      <Animated.View style={[panelStyle, { width: sidebarWidth }]}>
        <SidebarContent />
      </Animated.View>
    </>
  );
}
```

**`SidebarHandler`** — позиционирование поверх контента:
- Принимает: все пропсы sidebar + `topInset` для safe area
- Возвращает: wrapper с `position: absolute` для панели и кнопки
- Кнопка (`ChatSidebarTrigger`) фиксирована слева-сверху, поверх панели (z-index: 60)

```tsx
// src/app/(tabs)/chat/components/SidebarHandler/SidebarHandler.tsx
export function SidebarHandler({ isOpen, onClose, onToggle, isDesktop, sidebarWidth, topInset }) {
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}>
      <ChatSidebar isOpen={isOpen} onClose={onClose} isDesktop={isDesktop} sidebarWidth={sidebarWidth} />
      <View style={{ position: "absolute", left: 16, top: topInset + 12, zIndex: 60 }}>
        <ChatSidebarTrigger isOpen={isOpen} onPress={onToggle} />
      </View>
    </View>
  );
}
```

**`ChatSidebarTrigger`** — кнопка 30×30px:
- Принимает: `{ isOpen, onPress }`
- Возвращает: квадратная кнопка с закруглением 10px
- Одна кнопка для открытия и закрытия (toggle)

### Константы (ChatSidebar.config.ts)

```ts
ANIMATION_DURATION = 260           // мс анимации
CONTENT_TOP_OFFSET = 56           // отступ контента от верха (под кнопку)
PANEL_BOTTOM_RADIUS = 16          // скругление низа панели
SIDEBAR_DESKTOP_BREAKPOINT = 900  // px для переключения в desktop режим
SIDEBAR_MOBILE_RATIO = 0.7        // 70% ширины экрана на mobile
SIDEBAR_MOBILE_MIN_WIDTH = 240    // минимум для mobile
SIDEBAR_DESKTOP_WIDTH = 280       // фикс для desktop
```

### Моковый функционал

`SidebarContent` сейчас содержит заглушки:
- Поле поиска (без логики)
- Заглушка списка чатов ("Здесь появится список")
- Кнопка "Новый чат" (без обработчика)

TODO комментарий указывает на будущие хуки:
```ts
// - useChats() для получения списка чатов
// - useCreateChat() для создания нового чата
// - useChatSearch() для поиска по чатам
```

## 4. UI

Рендерится только на странице `/chat` (`src/app/(tabs)/chat.tsx`).

**Композиция страницы:**
```tsx
<View className="flex-1 bg-background">
  <ChatContent topInset={insets.top} />         {/* основной контент */}
  <SidebarHandler {...sidebar} topInset={...} /> {/* панель поверх */}
</View>
```

**Панель:**
- Выезжает слева с анимацией
- На mobile: затемнение фона, клик вне панели закрывает её
- На desktop: без затемнения, панель остаётся открытой по умолчанию
- Кнопка-триггер всегда на экране (слева-сверху), переключает состояние

**Внешний вид:**
- Фон: `colors.panelBackground` (#0E0E10)
- Граница справа: `colors.panelBorder` (rgba(255, 255, 255, 0.15))
- Скругление низа: 16px
- Поле поиска: placeholder цвет `colors.placeholder` (#8A8A90)

## 5. Поток данных

```
Монтирование /chat
  ↓
useChatSidebar() → { isOpen: isDesktop, sidebarWidth, open, close, toggle }
  ↓
ChatScreen рендерит SidebarHandler с пропсами sidebar
  ↓
SidebarHandler → ChatSidebar (панель) + ChatSidebarTrigger (кнопка)
  ↓
Клик по ChatSidebarTrigger → onToggle() → setIsOpen(!isOpen)
  ↓
useEffect в ChatSidebar → progress.value = withTiming(isOpen ? 1 : 0)
  ↓
useAnimatedStyle → translateX: interpolate(progress, [-sidebarWidth, 0])
  ↓
Панель анимированно выезжает/уезжает за 260мс
```

**Закрытие на mobile:**
```
Клик вне панели (на backdrop) → onClose() → setIsOpen(false) → анимация закрытия
```

## 6. Почему так, а не иначе

1. **Локальное размещение в `/chat`, а не в `shared/`**  
   ChatSidebar специфичен для страницы чата, не переиспользуется в других местах. Размещение в `shared/` создало бы ложное впечатление универсальности.

2. **Разделение на ChatContent / SidebarHandler**  
   Страница `chat.tsx` — чистая композиция без визуальной разметки. Каждый компонент отвечает за своё: контент или управление панелью. Легко тестировать и модифицировать отдельно.

3. **Без внедрения логики чатов на этом этапе**  
   Задача — UI и анимация панели. Логика работы с чатами (создание, поиск, список) будет добавлена через хуки в будущем, не меняя структуру компонентов.

4. **Три метода вместо одного toggle: `open`, `close`, `toggle`**  
   Явная семантика вместо неявной: `sidebar.open()` понятнее чем `sidebar.toggle()` (непонятно, откроет или закроет). В будущем при автооткрытии/закрытии по событиям явные методы предотвратят баги.

5. **Панель поверх контента (absolute), а не сдвиг**  
   Контент страницы не перерисовывается при открытии панели — производительность. На всех платформах одинаковое поведение.

## Преимущества

- ✅ Чистая композиция: страница = 23 строки без бизнес-логики
- ✅ Адаптивность: автоматический расчёт ширины и режима (mobile/desktop)
- ✅ Плавная анимация 260мс через Reanimated, безопасная интерполяция с CLAMP
- ✅ Готовность к расширению: TODO-комментарии для будущих хуков, структура не изменится
- ✅ Локализация: компонент живёт рядом со страницей, не засоряет shared
- ✅ Типобезопасность: отдельные `.types.ts` для каждого компонента
- ✅ Переиспользование инфраструктуры: safe area, colors, анимации из существующих либ
