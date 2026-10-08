# План: SwitchGlobal (RN) + нижняя навигация на layout-уровне

> План для агента-исполнителя. Ветка: `SwitcherGlobal`.
> Цель: портировать веб-компонент `SwitchGlobal` на React Native и подключить его как нижнюю навигацию приложения (3 вкладки: chat / api / check), всегда видимую внизу экрана.

## 0. Контекст проекта

- Стек: **React Native 0.86 + Expo (expo-router ~57) + NativeWind (Tailwind 3) + TypeScript + react-native-reanimated 4.5**.
- Структура: `src/app` — роуты expo-router, `src/app/(tabs)/` — вкладки.
- Старый UI-код считается мусором и подлежит удалению (см. §5). Инфраструктуру (`src/lib`, `src/stores`, `src/schemas`, `src/theme`) **не трогать**.
- Референс: веб-версия SwitchGlobal из другого проекта (описание и код у автора плана). Ключевое отличие: в RN нет DOM-рефов, `getBoundingClientRect` и `ResizeObserver` — измерения делаются через `onLayout`, анимация — через Reanimated.

## 1. Что делаем (сводка)

1. Компонент `SwitchGlobal` (RN-порт): переключатель с анимированным индикатором, который плавно «бежит» к активной опции.
2. Компонент `NavSwitch`: нижняя навигация на базе SwitchGlobal, подключённая **один раз на уровне layout** (custom tabBar expo-router), а не в каждом экране.
3. Три моковых экрана-вкладки: `chat`, `api`, `check` (пустые, только заголовок-назначение).
4. Тема: акцент — красный (чуть ярче приглушённого, без оранжевого оттенка, вместо фиолетового), фон — тёмно-серый, почти чёрный. Минимум скруглений (компонент живёт внизу экрана).

## 2. Дизайн-токены

Добавить в `tailwind.config.js` → `theme.extend.colors` (и продублировать в `src/theme/index.ts`, если там уже есть палитра):

| Токен | Значение | Назначение |
|---|---|---|
| `background` | `#141416` | фон приложения (тёмно-серый, почти чёрный) |
| `card` | `#1C1C1F` | фон нижней навигации / карточек |
| `accent` | `#C63B3B` | красный (не оранжевый) — индикатор, активный текст |
| `accent-soft` | `#A02F2F` | нажатие/второстепенные акценты |
| `text-primary` | `#EDEDEF` | основной текст |
| `text-muted` | `#8A8A90` | неактивные вкладки, подписи |

Скругления: контейнер навигации — `rounded-t-lg` (8px, только верхние углы), индикатор — `rounded-md` (6px). Никаких `rounded-full`/`rounded-xl`.

## 3. SwitchGlobal — RN-порт

Расположение: `src/shared/components/ui/SwitchGlobal/` — 4 файла, как в веб-референсе.

### 3.1 `SwitchGlobal.types.ts`

```ts
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type SwitchOption = {
  key: string;
  component: ReactNode;
};

export type SwitchGlobalProps = {
  options: SwitchOption[];
  value: string;                 // key активной опции — только для позиции индикатора
  onChange?: (key: string) => void;
  equalWidth?: boolean;          // true — все ячейки flex-1; false — ширина по контенту
  className?: string;            // NativeWind-стили контейнера
  sliderClassName?: string;      // NativeWind-стили индикатора
};
```

(Типы `SwitchItemRefs`/`SwitchIndicator` из веб-версии не нужны — вместо рефов будет карта измерений.)

### 3.2 `SwitchGlobal.hooks.ts` — `useSwitchGlobalHook`

Замена DOM-механики на RN-механику:

- `containerLayout` — измерения контейнера (`onLayout` контейнера: width).
- `itemLayouts` — `useRef(new Map<string, { x: number; width: number; height: number }>())`. Каждая ячейка и её контент измеряются одним `onLayout` на ячейке (в RN `onLayout` даёт координаты относительно родителя, поэтому достаточно одной ячейки: `x`, `width`, `height`).
- `updateIndicator()` — по `value` берёт измерение активной ячейки и возвращает `{ left, width, height }`:
  - `equalWidth === true` → `left = x`, `width = width` ячейки;
  - `equalWidth === false` → ширина по контенту (если нужно точнее — второй `onLayout` на контент-обёртке, как в веб-версии; допустимо упростить до ячейки, если контент растягивается на ячейку).
- Анимация через **Reanimated**: `useSharedValue` для `left` и `width`, обновление в `useEffect`/`useDerivedValue` через `withTiming(target, { duration: 300, easing: Easing.out(Easing.cubic) })`. Индикатор — `Animated.View` со `style` из `useAnimatedStyle`. Это заменяет CSS `transition-[left,width] duration-300 ease-out`.
- Пересчёт при изменении размеров: `onLayout` ячеек уже вызывает обновление — отдельный аналог `ResizeObserver` не нужен.
- Первый рендер: чтобы индикатор не «прилетал» из нуля, при первом измерении ставить значение сразу (`sharedValue.value = target` без `withTiming`), дальше — анимировать. Флаг «первого измерения» хранить в ref.

### 3.3 `SwitchGlobal.tsx`

- Контейнер: `View` c `role="tablist"` (`accessibilityRole="tablist"`), `className={cn('relative flex-row items-center rounded-md', equalWidth ? 'w-full' : 'self-start', className)}`.
- Индикатор: `Animated.View`, `pointerEvents="none"`, `absolute`, позиция из shared values, `className={cn('absolute rounded-md bg-accent', sliderClassName)}`.
- Опции: `Pressable` на каждую опцию:
  - `accessibilityRole="tab"`, `accessibilityState={{ selected: isActive }}`, `accessibilityLabel` из `option.key` (или добавить поле `label` в `SwitchOption` — на усмотрение исполнителя, но a11y-лейбл обязателен);
  - `onPress={() => !isActive && onChange?.(option.key)}`;
  - `className`: `equalWidth ? 'flex-1' : '', 'items-center justify-center'`.
- `options.length === 0` → `return null`.
- `cn` — написать локальную утилиту `clsx`-подобную (`src/shared/lib/cn.ts`), т.к. вебовой `@/5shared/lib/utils` нет. Зависимость `clsx` + `tailwind-merge` опционально; достаточно простого join непустых строк.

### 3.4 `index.ts`

Реэкспорт компонента и типов.

## 4. NavSwitch + подключение в layout

### 4.1 `src/shared/components/layout/NavSwitch/NavSwitch.tsx`

- Массив ссылок (мок):

```ts
const navLinks = [
  { key: 'chat',  label: 'Чат',      href: '/chat'  },
  { key: 'api',   label: 'API',      href: '/api'   },
  { key: 'check', label: 'FastCheck', href: '/check' },
];
```

- Активная вкладка определяется из пропсов custom tabBar expo-router (`state.index` → `state.routes[index].name`) — это надёжнее, чем `usePathname`.
- Переход: `router.navigate(href)` из `expo-router` (или `navigation.navigate` из пропсов tabBar).
- Разметка:

```tsx
<View className="w-full bg-card rounded-t-lg border-t border-white/5">
  <SwitchGlobal
    equalWidth
    options={navLinks.map(...)}   // component: Pressable/View с иконкой(опц.) + label
    value={currentKey}
    onChange={(key) => router.navigate(...)}
    className="w-full bg-card p-2"
    sliderClassName="bg-accent"
  />
</View>
```

- Активный текст — `text-text-primary`, неактивный — `text-text-muted`; сам индикатор — заливка `bg-accent`, текст поверх него читается (светлый).
- Safe area: обернуть низ в `paddingBottom: insets.bottom` через `useSafeAreaInsets` (`react-native-safe-area-context`), чтобы навигация не уезжала под жест-бар на iOS.
- Иконки: на этом этапе можно без иконок (только текст) либо простые текстовые глифы; lucide-react недоступен в RN — если иконки нужны, взять `lucide-react-native` (отдельная установка, не обязана входить в этот этап).

### 4.2 `src/app/(tabs)/_layout.tsx`

Подключение на уровне layout — custom tabBar:

```tsx
import { Tabs } from 'expo-router';
import NavSwitch from '@/shared/components/layout/NavSwitch/NavSwitch';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <NavSwitch {...props} />}
    >
      <Tabs.Screen name="chat" options={{ title: 'Чат' }} />
      <Tabs.Screen name="api" options={{ title: 'API' }} />
      <Tabs.Screen name="check" options={{ title: 'FastCheck' }} />
    </Tabs>
  );
}
```

Так навигация рендерится ровно один раз, всегда видна внизу, а экраны — обычные children роутера. `headerShown: false`, т.к. у приложения свой верхний бар (настройки — позже).

### 4.3 Экраны-заглушки

`src/app/(tabs)/chat.tsx`, `api.tsx`, `check.tsx` — одинаковые моки: `View` c `flex-1 bg-background` + `Text` с названием и назначением вкладки (по VISION.md: Чат / Шаблоны-API / FastCheck). Порядок вкладок: chat → api → check (chat — initial route).

> Примечание: в задании вкладки названы «char/api/check». По VISION.md первая вкладка — чат, поэтому в плане используется `chat`. Если «char» не опечатка — переименовать роут, логика не меняется.

### 4.4 `src/app/_layout.tsx`

- Оставить `Stack` + `ThemeProvider`, убрать `Stack.Screen name="chat/[id]"` (экран удаляется, §5).
- Фон стека привести к `background` (`contentStyle={{ backgroundColor: '#141416' }}` или через тему).

## 5. Чистка старого кода

Удалить:

- `src/app/(tabs)/index.tsx`, `src/app/(tabs)/settings.tsx` (заменяются на chat/api/check);
- `src/app/chat/[id].tsx` и его `Stack.Screen` в root layout;
- эмодзи-иконки и `tabBarActiveTintColor` из старого `(tabs)/_layout.tsx` (файл переписывается целиком).

Не трогать: `src/lib/**`, `src/stores/**`, `src/schemas/**`, `src/theme/**`, `src/global.css` (кроме случая, если тема заведётся через CSS-переменные — тогда токены из §2 можно продублировать туда).

## 6. Порядок работ

1. Токены цветов в `tailwind.config.js` (+ `src/theme`, если уместно).
2. `SwitchGlobal` (types → hooks → tsx → index) + `cn`.
3. `NavSwitch`.
4. `(tabs)/_layout.tsx` с custom tabBar + три мок-экрана.
5. Чистка старых экранов и root layout.
6. Проверка (§7).

## 7. Критерии приёмки

- [ ] Индикатор плавно (≈300ms, ease-out) перемещается между вкладками, в т.ч. при первом рендере без «прыжка из угла».
- [ ] Навигация всегда видна внизу, рендерится один раз на уровне `(tabs)/_layout.tsx`; экраны не содержат навигационного кода.
- [ ] 3 вкладки chat/api/check переключаются через expo-router (URL/роут меняется, экран меняется).
- [ ] `equalWidth` работает: ячейки равные, индикатор по ширине ячейки.
- [ ] Цвета: акцент красный `#C63B3B` (не оранжевый, не ярко-алый), фон почти чёрный; скругления только `rounded-t-lg` (контейнер) и `rounded-md` (индикатор).
- [ ] A11y: `tablist`/`tab`, `accessibilityState.selected`, тап по неактивной вкладке вызывает `onChange`/навигацию.
- [ ] Safe area: на iOS с жест-баром контент навигации не перекрывается.
- [ ] Старые экраны и ссылки на них удалены, `tsc`/lint без ошибок.
