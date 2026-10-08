# SwitchGlobal — Анимированный переключатель

## 📋 Описание

`SwitchGlobal` — это кастомный компонент-переключатель с анимированным индикатором, который плавно скользит под активной опцией. Используется для навигации и переключения между режимами.

**Расположение:**
- Компонент: `src/shared/components/ui/SwitchGlobal/`
- Пример использования: `src/shared/components/layout/NavSwitch/NavSwitch.tsx`

---

## 🎯 Основные возможности

- ✅ Плавная анимация индикатора (300ms cubic easing)
- ✅ Автоматическое измерение размеров элементов через `onLayout`
- ✅ Равная ширина кнопок (опция `equalWidth`)
- ✅ Accessibility (role="tablist", aria-selected)
- ✅ Работает на iOS/Android через React Native Reanimated

---

## 🔄 Поток данных

### 1️⃣ Инициализация

```
Родитель передаёт value → SwitchGlobal рендерится → Каждая кнопка монтируется
  │
  └─→ onLayout срабатывает для каждой кнопки
      └─→ onItemLayout(key, layout) записывает размеры в Map
          └─→ syncIndicator(false) — первый раз БЕЗ анимации
              └─→ left.value = x, width.value = w (мгновенно)
```

**Важно:** При первом рендере индикатор не анимируется, чтобы не "прилетал" из позиции `(0, 0)`.

---

### 2️⃣ Переключение (анимация)

```
Пользователь нажимает на кнопку
  │
  ├─→ onChange(newKey) вызывается
  │
  └─→ Родитель обновляет свой state
      │
      └─→ value меняется: "chat" → "api"
          │
          └─→ Хук видит изменение value
              │
              └─→ useEffect срабатывает
                  │
                  └─→ syncIndicator(true) — С анимацией!
                      │
                      ├─→ itemLayouts.current.get("api") — достаём готовые размеры
                      │
                      └─→ withTiming(newX, 300ms) — анимируем left/width/height
```

---

## 🧩 Архитектура компонентов

### SwitchGlobal.tsx (UI)

**Ответственность:** Рендер и обработка взаимодействий

```tsx
<View> {/* Контейнер */}
  <Animated.View> {/* Анимированный индикатор */}
    <View className="bg-accent" />
  </Animated.View>
  
  {options.map(option => (
    <Pressable 
      onPress={() => onChange(option.key)}
      onLayout={(e) => onItemLayout(option.key, e.nativeEvent.layout)}
    >
      {option.component}
    </Pressable>
  ))}
</View>
```

**Ключевые моменты:**
- `onLayout` — автоматически вызывается React Native при размещении компонента
- `pointerEvents="none"` на индикаторе — не блокирует клики по кнопкам
- `Animated.View` получает стили через `useAnimatedStyle`, а не className (NativeWind не работает с reanimated-обёртками)

---

### SwitchGlobal.hooks.ts (Логика)

**Ответственность:** Управление анимацией индикатора

#### Данные:

```typescript
const itemLayouts = useRef(new Map<string, SwitchItemLayout>());
// Map { "chat" => { x: 0, width: 100, height: 40 }, ... }

const hasMeasured = useRef(false);
// Флаг: было ли первое измерение

const left = useSharedValue(0);   // Reanimated shared value
const width = useSharedValue(0);  // Мутация .value обновляет анимацию
const height = useSharedValue(0);
```

#### Функции:

**`onItemLayout(key, layout)`** — сохраняет размеры кнопки
```typescript
itemLayouts.current.set(key, layout);
syncIndicator(hasMeasured.current);
```

**`syncIndicator(animate)`** — обновляет позицию индикатора
```typescript
const layout = itemLayouts.current.get(value); // value из пропсов хука

if (!animate || !hasMeasured.current) {
  // Первый раз — мгновенно
  left.value = layout.x;
  width.value = layout.width;
  hasMeasured.current = true;
} else {
  // Дальше — с анимацией
  left.value = withTiming(layout.x, { duration: 300, easing: Easing.out(Easing.cubic) });
  width.value = withTiming(layout.width, ...);
}
```

**`useEffect`** — реагирует на смену `value`
```typescript
useEffect(() => {
  syncIndicator(hasMeasured.current);
}, [syncIndicator]);
```

Зависимость `syncIndicator` пересоздаётся при изменении `value` → эффект срабатывает.

---

## 🔗 Связь родитель ↔ SwitchGlobal

### Родитель (NavSwitch.tsx)

```tsx
function NavSwitch({ state }: BottomTabBarProps) {
  // 1️⃣ Определяет текущий активный ключ из роутера
  const currentKey = navLinks.find(
    link => link.key === state.routes[state.index]?.name
  )?.key ?? 'chat';

  return (
    <SwitchGlobal
      value={currentKey}  // 2️⃣ Передаёт активный ключ
      onChange={(key) => {
        const link = navLinks.find(item => item.key === key);
        if (link) router.navigate(link.href);  // 3️⃣ Меняет роут
      }}
      options={navLinks.map(link => ({
        key: link.key,
        component: <Text>{link.label}</Text>
      }))}
    />
  );
}
```

### Как родитель "понимает", что произошла смена?

**Родитель НЕ "понимает" про анимацию** — это внутреннее дело `SwitchGlobal`.

**Реальный поток:**

```
1. Пользователь нажимает кнопку
   ↓
2. onChange("api") вызывается (колбэк из родителя)
   ↓
3. Родитель меняет навигацию: router.navigate('/api')
   ↓
4. Роутер меняет state.routes[state.index]
   ↓
5. Родитель ре-рендерится с новым currentKey = "api"
   ↓
6. SwitchGlobal получает новый value="api"
   ↓
7. Хук видит изменение value → useEffect → syncIndicator → анимация!
```

**Важно:** 
- Родитель — **источник истины** (single source of truth)
- `SwitchGlobal` — **controlled component** (не хранит состояние, только визуализирует)
- Анимация — **побочный эффект** изменения пропса `value`

---

## 📦 Пример использования

```tsx
import { useState } from 'react';
import { SwitchGlobal } from '@/shared/components/ui/SwitchGlobal';

function MyComponent() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <SwitchGlobal
      value={activeTab}
      onChange={setActiveTab}
      equalWidth={true}
      options={[
        { key: 'home', component: <Text>Главная</Text> },
        { key: 'profile', component: <Text>Профиль</Text> },
        { key: 'settings', component: <Text>Настройки</Text> }
      ]}
      className="bg-gray-800"
      sliderClassName="bg-blue-500"
    />
  );
}
```

---

## 🎨 Стилизация

```tsx
<SwitchGlobal
  className="bg-card rounded-xl"        // Контейнер
  sliderClassName="bg-accent rounded-lg" // Индикатор
  equalWidth={true}                      // Кнопки равной ширины
/>
```

**Ограничение NativeWind:** 
`Animated.View` не поддерживает `className` напрямую. Геометрия индикатора задаётся через `style`, визуальные стили — через вложенный обычный `View`.

---

## 🐛 Распространённые ошибки

### ❌ Забыли передать уникальные ключи

```tsx
options={[
  { key: 'tab', component: <Text>Tab 1</Text> },
  { key: 'tab', component: <Text>Tab 2</Text> }  // Дубликат!
]}
```

**Результат:** Индикатор не переключается.

### ❌ value не соответствует ключам в options

```tsx
<SwitchGlobal
  value="unknown"  // Такого ключа нет в options!
  options={[{ key: 'home', ... }]}
/>
```

**Результат:** Индикатор не отображается (`layout = undefined`).

### ❌ Изменение options без ключей

```tsx
// Неправильно: при каждом рендере новые объекты
options={[{ key: 'home', component: <Text>Home</Text> }]}

// Правильно: определить вне компонента или useMemo
const OPTIONS = [{ key: 'home', component: <Text>Home</Text> }];
```

---

## 🔧 Технические детали

### Почему Reanimated Shared Values?

```typescript
left.value = withTiming(100);
```

- **Работает на UI-потоке** (60 FPS даже при загруженном JS-потоке)
- **Мутабельность — это фича**, не баг (официальный API)
- **Не вызывает ре-рендеры** React-компонента

### Почему useRef для Map?

```typescript
const itemLayouts = useRef(new Map<string, SwitchItemLayout>());
```

- **Сохраняется между рендерами** (не пересоздаётся)
- **Мутация не вызывает ре-рендер** (нужно для производительности)
- **Синхронный доступ** при вызове `onLayout`

### Почему отключили eslint react-hooks/immutability?

```typescript
/* eslint-disable react-hooks/immutability */
left.value = layout.x;
```

Правило блокирует мутации, но Reanimated Shared Values **требуют** мутации для работы. Это задокументированный паттерн из официальной документации.

---

## 📚 См. также

- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- [onLayout в React Native](https://reactnative.dev/docs/view#onlayout)
- [Controlled Components](https://react.dev/learn/sharing-state-between-components)
