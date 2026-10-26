---

**Дата:** 26.10.2026
**Теги:** #refactoring #model-selection #validation #animations #structure

---

# Рефакторинг выбора моделей и формы шаблонов API

## Обзор изменений

За один заход решено несколько связанных проблем вокруг фичи выбора модели:

- **Валидация перенесена из схемы в UX.** Из zod-схемы удалены `superRefine` («модель требует ключ») и минимальная длина ключа — состояние «модель без ключа» и «короткий ключ» стали недостижимы по построению интерфейса.
- **ModelSelect переписан.** Логика вынесена в хук `useModelSelect`, дропдаун переведён с полноэкранного Modal на якорный `PopoverMenu` (открывается у поля, со `ScrollIndicator` справа).
- **Нормализация списка моделей.** Мусорный префикс «~»/«~/» в `id` от провайдера срезается при нормализации, дедуп — после среза.
- **Структура папок чата.** `ChatSidebar` и `ChatContent` разобраны на подпапки «один компонент — одна папка», все перемещения через `git mv`.
- **Анимации формы и списка.** Очистка полей после добавления, состояния кнопки Add, синхронизированные тайминги формы и списка через общий конфиг.

---

## Часть 1: Валидация — superRefine и минимальная длина ключа

### Проблема(ы)

**Проблема 1:** В `apiTemplateFormSchema` висел `superRefine` «модель требует ключ» с экспортированным `MODEL_REQUIRES_API_KEY_MESSAGE`. Хук формы разбирал issues, чтобы отличить это правило от остальных, и показывал отдельный тост `keyRequired`. При этом само состояние «выбрана модель, но ключа нет» уже недостижимо: ModelSelect не даёт открыть список без ключа, а смена ключа/провайдера сбрасывает модель. Правило валидировало то, что UI не позволяет сделать.

**Проблема 2:** Константа `MODELS_MIN_API_KEY_LENGTH` резала ключи по длине до запроса к провайдеру. Реальный критерий валидности ключа знает только провайдер — локальная эвристика длины давала ложные отказы и лишнее состояние ошибки.

### Решения

#### 1.1. Схема — только форма, без кросс-полевых правил

**Файл:** `src/schemas/api-template.ts`

```ts
// src/schemas/api-template.ts
/** Форма создания шаблона API */
export const apiTemplateFormSchema = z.object({
  name: z.string().trim().min(1),
  provider: apiTemplateProviderSchema,
  model: z.string().trim().min(1),
  apiKey: z.string().min(1),
});
```

**Логика:** Схема описывает только форму как данные: непустые поля и валидный провайдер. `MODEL_REQUIRES_API_KEY_MESSAGE` и `superRefine` удалены полностью — инвариант «модель выбрана → ключ есть» теперь держит сам ModelSelect (см. Часть 2), а не валидация постфактум. Следствие: в `useTemplateForm` исчезли разбор issues, флаг `apiKeyError` и тост `keyRequired` — любая ошибка схемы означает одно: «заполнены не все поля» → один тост `invalidForm`. i18n-ключ `apiTab.keyRequired` удалён из en/ru.

#### 1.2. Удаление минимальной длины ключа

**Файл:** `src/shared/lib/ai/models.config.ts`

```ts
// src/shared/lib/ai/models.config.ts
/** Задержка перед авто-запросом списка моделей после ввода ключа */
export const MODELS_FETCH_DEBOUNCE_MS = 1000;
```

**Логика:** `MODELS_MIN_API_KEY_LENGTH` удалена — единственное условие запроса списка моделей: непустой ключ. Триггеры запроса: вставка из буфера (детектится скачком длины: `+>1 символ` за раз — в RN нет события paste) → сразу; ручной ввод посимвольно → дебаунс поднят с 700мс до 1000мс, чтобы не дёргать провайдера на каждом символе; потеря фокуса поля (`onBlur`) → сразу. Ложное срабатывание «вставки» безопасно — оно лишь отменяет задержку.

---

## Часть 2: ModelSelect — хук, состояния, якорный дропдаун

### Проблема(ы)

**Проблема 1:** Компонент `ModelSelect` содержал всю логику (кэш стора, статусы, фильтр) внутри себя, при этом хук `useModelSelect.ts` существовал, но не был подключён — компонент и хук жили параллельно.

**Проблема 2:** Дропдаун открывался как полноэкранный Modal с отступом сверху (`pt-24`) — список моделей появлялся высоко над полем, далеко от места нажатия. Скролл-индикатора не было, а в остальных поповерах проекта (chatArea, ChatSidebar, TemplatePickerPopover) он есть справа.

### Решения

#### 2.1. Логика — в хук, компонент — только рендер

**Файл:** `src/shared/components/ModelSelect/useModelSelect.ts`

```ts
// src/shared/components/ModelSelect/useModelSelect.ts
const cacheKey = modelsCacheKey(provider, apiKey);
const entry = useModelsStore((state) => state.entries[cacheKey]);
const status = entry?.status ?? "idle";
const models = entry?.models ?? EMPTY_MODELS;

const hasList = status === "ready" && models.length > 0;
const filtered = useMemo(() => filterModels(models, query), [models, query]);

// Дропдаун заблокирован без ключа: список моделей неоткуда получить
const isDropdownLocked = disabled || apiKey.trim() === "";
```

**Логика:** Хук читает запись кэша стора по ключу `provider + apiKey` и отдаёт компоненту только производные значения: `status`, `hasList`, `filtered`, `isDropdownLocked`. Компонент стал чистым рендером машины состояний: `idle` без ключа → заблокированное поле с подсказкой «Вставьте ключ, чтобы загрузить модели» (новый i18n-ключ `modelSelect.insertKeyHint`); `loading` → спиннер; `ready` со списком → дропдаун; ошибка/пустой список → ручной ввод имени модели. Константы `FIELD_CLASS` и `EMPTY_MODELS` переехали в `ModelSelect.config.ts`.

#### 2.2. Якорный дропдаун вместо полноэкранного Modal

**Файл:** `src/shared/components/ModelSelect/ModelSelect.tsx`

```tsx
// src/shared/components/ModelSelect/ModelSelect.tsx
const handleOpen = () => {
  if (isDropdownLocked) return;

  triggerRef.current?.measureInWindow((x, y, width, height) => {
    setAnchor({ x, y, width, height });
    openDropdown();
  });
};

// ...

<PopoverMenu
  open={isOpen}
  onClose={closeDropdown}
  anchor={anchor}
  placement="bottom-start"
  width={anchor?.width ?? FALLBACK_POPOVER_WIDTH}
  maxHeight={MODEL_LIST_MAX_HEIGHT}
>
```

**Логика:** Тот же паттерн, что в `TemplatePickerPopover`: перед открытием поле измеряется через `measureInWindow`, и панель открывается сразу под полем (`bottom-start`), шириной с само поле. `ScrollIndicator` справа встроен в `PopoverMenu` — отдельный пункт «добавить скроллбар» закрылся сам паттерном. В `PopoverMenu` добавлен `keyboardShouldPersistTaps="handled"`: в дропдауне теперь есть поиск, и тап по модели при открытой клавиатуре должен срабатывать с первого раза, а не после первого закрытия клавиатуры.

---

## Часть 3: Нормализация списка моделей

### Проблема(ы)

**Проблема:** Некоторые провайдеры возвращают в `data[].id` мусорный префикс «~» или «~/» — он проходил нормализацию как есть, попадал в дропдаун, сохранялся в шаблон и уходил в чат-запрос. Плюс дедуп шёл по сырым id: после среза префикса появились бы дубли (`~/m1` и `m1`).

### Решения

#### 3.1. Срез префикса и дедуп после среза

**Файл:** `src/shared/lib/ai/normalize-models.ts`

```ts
// src/shared/lib/ai/normalize-models.ts
export function normalizeModelList(payload: unknown): string[] {
  const data = (payload as ProviderModelsResponse | null)?.data;

  if (!Array.isArray(data)) return [];

  const ids = new Set<string>();

  for (const item of data) {
    const id = typeof item?.id === "string" ? cleanModelId(item.id) : "";

    if (id !== "") ids.add(id);
  }

  return [...ids].sort((a, b) => a.localeCompare(b));
}

/** Ведущий «~» или «~/» — артефакт ответа провайдера, не часть имени модели */
function cleanModelId(raw: string): string {
  return raw.trim().replace(/^~\/?/, "");
}
```

**Логика:** Очистка выделена в `cleanModelId`: trim + срез одного ведущего «~» с опциональным слэшем. Дедуп через `Set` идёт уже по очищенным именам, поэтому `~/m1` и `m1` схлопываются в одну запись. Очищенное имя уходит везде: в дропдаун, в значение шаблона и в чат-запрос — расхождения между тем, что видит пользователь, и тем, что уходит в API, нет. В `tests/api-templates/normalize-models.test.ts` добавлены тесты на срез и дедупликацию после среза.

---

## Часть 4: Структура папок чата

### Проблема(ы)

**Проблема:** В `ChatSidebar/` и `ChatContent/` компоненты, их типы, конфиги и хуки лежали одной кучей в корне папки — нарушен собственный паттерн проекта «один компонент — одна папка с `index.ts`» (как у `ChatListItem`, `ChatListSection`, `TempChatButton`).

### Решения

#### 4.1. Подпапки через git mv

**Файлы:** `src/app/(tabs)/chat/components/**`

```
ChatSidebar/
  ChatSidebar/           ← сам ChatSidebar.tsx + index.ts
  ChatSidebarTrigger/    ← был в корне рядом с ChatSidebar.tsx
  ChatScrollList/        ← был в корне
  ChatListItem/
    ChatItemPopover/     ← поповеры (ChatItemPopover, ChatPopoverMenu/Delete/Rename, конфиг, типы)
    ChatListItem.tsx, config, types, useChatPopover.ts, index.ts
  ChatSidebar.config.ts, ChatSidebar.hooks.ts, ChatSidebar.types.ts, index.ts  ← общие, в корне
ChatContent/
  ChatContent/           ← ChatContent.tsx, types, useKeyboardInset.ts
  ChatInputArea/         ← ChatInputArea.tsx, types, useChatInput.ts
  ChatMessages/
  TemplatePickerPopover/
  index.ts
```

**Логика:** Все перемещения — `git mv`, история файлов сохранена. У каждой подпапки свой `index.ts`, родительские индексы реэкспортируют из подпапок — внешние импорты (`chat.tsx`, `SidebarHandler`) не изменились. Поправлены только относительные импорты внутри перемещённых файлов (`./ChatListItem.config` → `../ChatListItem.config` и т.п.). Общие для группы файлы (config/hooks/types) остались в корне группы — они принадлежат папке, а не одному компоненту.

---

## Часть 5: Анимации формы и списка шаблонов

### Проблема(ы)

**Проблема 1:** После добавления шаблона поля формы сбрасывались резко, без анимации.

**Проблема 2:** Кнопка Add всегда была красной, даже когда форма пуста — непонятно, доступно ли действие.

**Проблема 3:** Анимации списка (FadeIn/FadeOut/LinearTransition) были вписаны литеральными числами в компоненте и не совпадали по таймингам с формой — вход нового шаблона и очистка полей выглядели как два независимых события.

### Решения

#### 5.1. Общий конфиг таймингов

**Файл:** `src/app/(tabs)/api/components/api-tab.animation.ts`

```ts
// src/app/(tabs)/api/components/api-tab.animation.ts
export const API_TAB_ANIMATION = {
  /** Затухание полей формы при очистке после добавления */
  formFadeOut: 200,
  /** Возвращение полей формы после очистки */
  formFadeIn: 200,
  /** Вход нового элемента списка */
  listEnter: 300,
  /** Выход удалённого элемента списка */
  listExit: 250,
  /** Перестроение списка при добавлении/удалении */
  listLayout: 300,
} as const;
```

**Логика:** Один источник таймингов и для формы, и для списка. Синхронизация по построению: `addTemplate` резолвится → список начинает вход (`listEnter`), а поля формы гаснут (`formFadeOut`) и возвращаются (`formFadeIn`) уже пустыми — оба движения идут одновременно, а не последовательно.

#### 5.2. Плавная очистка полей

**Файл:** `src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts`

```ts
// src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts
// Поля гаснут, очищаются невидимыми и возвращаются — тайминги общие
// со списком, чтобы вход нового шаблона совпадал с очисткой формы
setIsClearing(true);
if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
clearTimerRef.current = setTimeout(() => {
  setName("");
  setModel("");
  setApiKeyState("");
  setIsClearing(false);
}, API_TAB_ANIMATION.formFadeOut);
```

**Логика:** Хук держит флаг `isClearing`; компонент оборачивает блок полей и кнопку в `Animated.View` с `useAnimatedStyle` (opacity 0/1 через `withTiming`). Значения очищаются, пока блок невидим — пользователь не видит «мигания» текста. Таймер хранится в ref и чистится при анмаунте. `isClearing` заодно блокирует повторное нажатие Add — защита от двойного `addTemplate`. Заодно удалён мёртвый `apiKeyError`, оставшийся от старой валидации.

#### 5.3. Кнопка Add: серая → красная

**Файл:** `src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx`

```tsx
// src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx
// canSubmit = name && model && apiKey (из хука)
<Pressable
  accessibilityState={{ disabled: !canSubmit || isClearing }}
  disabled={!canSubmit || isClearing}
  onPress={() => void handleAdd()}
  className="items-center py-2.5"
>
```

**Логика:** Пока не заполнены имя/модель/ключ — кнопка серая (`colors.card`) с приглушённым текстом и `disabled`. Когда всё заполнено — фон и цвет текста плавно переходят в акцентные через `withTiming` (200мс, тот же конфиг). `accessibilityState.disabled` — для скринридеров. Провайдер в `canSubmit` не участвует: он выбран всегда по умолчанию.

#### 5.4. Явнее вход элемента списка

**Файл:** `src/app/(tabs)/api/components/TemplateList/TemplateList.tsx`

```tsx
// src/app/(tabs)/api/components/TemplateList/TemplateList.tsx
<Animated.View
  key={template.id}
  layout={LinearTransition.duration(API_TAB_ANIMATION.listLayout)}
  entering={FadeInUp.duration(API_TAB_ANIMATION.listEnter)}
  exiting={FadeOut.duration(API_TAB_ANIMATION.listExit)}
```

**Логика:** `FadeIn` заменён на `FadeInUp` — лёгкий сдвиг снизу делает вход нового шаблона заметнее, длительность поднята до 300мс. Все три тайминга берутся из общего конфига, литеральных чисел в компоненте больше нет.

---

## Итоги

### Изменённые файлы (25+ шт)

**Валидация и форма:**
1. `src/schemas/api-template.ts` — удалены `superRefine` и `MODEL_REQUIRES_API_KEY_MESSAGE`
2. `src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts` — очистка через `isClearing`, `canSubmit`, удалены `apiKeyError` и разбор issues
3. `src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx` — анимация полей, анимированная кнопка Add, `onBlur` на ключе
4. `src/shared/i18n/messages/en.json`, `ru.json` — удалён `apiTab.keyRequired`, добавлен `modelSelect.insertKeyHint`

**ModelSelect и модели:**
5. `src/shared/components/ModelSelect/useModelSelect.ts` — новый хук, вся логика селекта
6. `src/shared/components/ModelSelect/ModelSelect.tsx` — чистый рендер, якорный PopoverMenu
7. `src/shared/components/ModelSelect/ModelSelect.config.ts` — `FIELD_CLASS`, `EMPTY_MODELS`, `MODEL_LIST_MAX_HEIGHT`
8. `src/shared/lib/ai/models.config.ts` — удалена `MODELS_MIN_API_KEY_LENGTH`, дебаунс 700→1000мс
9. `src/shared/lib/ai/normalize-models.ts` — `cleanModelId`, срез «~»/«~/», дедуп после среза
10. `src/shared/components/ui/PopoverMenu/PopoverMenu.tsx` — `keyboardShouldPersistTaps="handled"`

**Структура чата (git mv + индексы):**
11. `src/app/(tabs)/chat/components/ChatSidebar/**` — подпапки ChatSidebar, ChatSidebarTrigger, ChatScrollList, ChatListItem/ChatItemPopover
12. `src/app/(tabs)/chat/components/ChatContent/**` — подпапки ChatContent, ChatInputArea, ChatMessages, TemplatePickerPopover

**Анимации и список:**
13. `src/app/(tabs)/api/components/api-tab.animation.ts` — новый общий конфиг таймингов
14. `src/app/(tabs)/api/components/TemplateList/TemplateList.tsx` — FadeInUp, тайминги из конфига

**Тесты и доки:**
15. `tests/api-templates/normalize-models.test.ts` — тесты среза «~» и дедупа
16. `tests/api-templates/api-template-validation.test.ts` — переписан под схему без superRefine
17. `docs/features/model-selection.md` — переписана: карта архитектуры, машина состояний, потоки данных

### Результаты

- ✅ Состояние «модель без ключа» и «ключ короче N» недостижимы по построению UI — валидация не дублирует UX
- ✅ Любая ошибка формы = один тост `invalidForm`, без разбора zod-issues в хуке
- ✅ Запрос списка моделей: непустой ключ; вставка — сразу, ввод — дебаунс 1с, blur — сразу
- ✅ В дропдауне, шаблоне и чат-запросе — одно и то же имя модели, без префикса «~»
- ✅ Дропдаун открывается у поля нажатия, со скролл-индикатором справа — единый паттерн с остальными поповерами
- ✅ Очистка полей, вход нового шаблона и состояния кнопки анимированы и синхронны по таймингам
- ✅ «Один компонент — одна папка» соблюдён в ChatSidebar и ChatContent, история git сохранена
- ✅ tsc, expo lint, 11/11 тестов — чисто

---

## Принципы, использованные при рефакторинге

- **Make invalid states unrepresentable** — вместо валидации недостижимых состояний (superRefine, min-длина) устранены сами состояния: UI не позволяет их создать.
- **Single source of truth** — тайминги анимаций в одном конфиге, логика селекта в одном хуке, очищенное имя модели везде одинаковое.
- **Reuse over rewrite** — дропдаун не писался заново: переиспользован готовый `PopoverMenu` со встроенным `ScrollIndicator`, тот же паттерн, что в TemplatePickerPopover.
- **Surgical Changes** — точечные изменения без переписывания рабочего кода; перемещения файлов через `git mv` с сохранением истории.
- **Dead code removal** — удалены `apiKeyError`, `keyRequired`, `MODELS_MIN_API_KEY_LENGTH` вместо того, чтобы оставлять «на всякий случай».
