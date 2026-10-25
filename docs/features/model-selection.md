---

**Дата:** 25.10.2026
**Теги:** #features #api-templates #models #ui #validation

---

## 1. Зачем

В форме создания шаблона API модель вводилась вручную как произвольная строка: пользователь должен был точно знать id модели (`gpt-4o-mini`, `claude-sonnet-4` и т.д.), опечатка или устаревшее имя обнаруживались только при первой отправке сообщения — ошибкой от провайдера. При этом у всех поддерживаемых провайдеров (OpenAI-совместимый `GET /models`) список моделей можно получить по тому же ключу, который пользователь уже ввёл. Фича — дропдаун выбора модели из реального списка провайдера с поиском, плюс явная валидация «модель без ключа» вместо молчаливого сохранения битого шаблона.

## 2. Где/что уже было

Задача была не писать новое, а собрать фичу из уже готовых кусков:

- **`openai-compat-client.ts`** — паттерн запроса к провайдеру с устройства: нативный `expo/fetch`, `Authorization: Bearer`, без бекенда. Новый клиент моделей повторяет этот паттерн, но не переиспользует сам клиент (тот заточен под chat completions со стримингом).
- **`API_TEMPLATE_PRESETS`** (`types/api-template.ts`) — пресеты провайдеров уже содержат `baseUrl`, из которого строится `GET {baseUrl}/models`. Новый код не добавляет ни одного нового URL.
- **Паттерн zustand-стора с in-memory кэшем** — как в `search-store.ts`/`templates-store.ts`: стор держит только сериализуемое состояние, таймеры и AbortController живут рядом.
- **`showToast`** (`shared/components/ui/Toast`) и **`useT`** (i18n) — существующие механизмы ошибок и локализации.
- **Схема `apiTemplateFormSchema`** — уже была точкой валидации формы, superRefine добавлен в неё, а не в хук.

## 3. Реализация

### 3.1 Слой данных: `src/shared/lib/ai/`

**`models.ts` — `fetchAvailableModels({ baseUrl, apiKey, signal })`:**
- Принимает: baseUrl провайдера, ключ, опциональный внешний `AbortSignal`.
- Возвращает: `{ ok: true, models: string[] } | { ok: false, reason: 'network' | 'unauthorized' | 'other' }` — ошибки классифицируются в результат, наверх ничего не выбрасывается.
- Один `AbortController` совмещает внешний сигнал и таймаут `MODELS_REQUEST_TIMEOUT_MS = 15000`: внешний abort прокидывается в контроллер, таймаут абортит тот же контроллер. Аборт — не сетевая ошибка (`TypeError`), поэтому различается по `controller.signal.aborted`.

```ts
// src/shared/lib/ai/models.ts
const controller = new AbortController();
const onExternalAbort = () => controller.abort();
signal?.addEventListener('abort', onExternalAbort);
const timeout = setTimeout(() => controller.abort(), MODELS_REQUEST_TIMEOUT_MS);
// ...
const response = await fetch(`${baseUrl}/models`, {
  headers: { Authorization: `Bearer ${apiKey}` },
  signal: controller.signal,
});
if (response.status === 401 || response.status === 403) {
  return { ok: false, reason: 'unauthorized' };
}
```

**`normalize-models.ts` — `normalizeModelList(payload)`:**
- Принимает: распарсенный JSON ответа провайдера (типизирован как `unknown`).
- Возвращает: отсортированный массив уникальных id (`data[].id`, только непустые строки, trim, dedup через `Set`, `localeCompare`).
- Вынесена в отдельный файл от клиента сознательно: `models.ts` тянет `expo/fetch`, который недоступен в node-тестах, а нормализация — чистая функция.

**`models-store.ts` — `useModelsStore` (zustand):**
- Кэш по ключу `modelsCacheKey(provider, apiKey)` = `"{provider}|{apiKey}"` — у разных провайдеров и разных ключей списки разные.
- `ensureModels(provider, baseUrl, apiKey)`: если запись уже `ready` или `loading` — выход (дедупликация параллельных вызовов); иначе ставит `loading`, делает запрос, пишет `ready`/`error`. Защита от гонки: после `await` проверяется, что контроллер в карте всё ещё тот же — если ключ сбросили/заменили, пока запрос был в полёте, устаревший ответ не перезапишет состояние новой записи.
- `cancelKey(provider, apiKey)`: абортит in-flight запрос и удаляет запись кэша. Вызывается при смене ключа в форме.
- In-memory на сессию: рестарт приложения сбрасывает кэш, ничего не персистится (список моделей — дешёвый запрос, а не секрет).

**`models.config.ts` — константы:**

```ts
// src/shared/lib/ai/models.config.ts
MODELS_REQUEST_TIMEOUT_MS = 15000  // таймаут GET /models
MODELS_MIN_API_KEY_LENGTH = 20     // с какой длины ключа разрешён авто-запрос
MODELS_FETCH_DEBOUNCE_MS = 700     // пауза после остановки ввода ключа
```

### 3.2 Валидация: superRefine в схеме

Ошибка «модель без ключа» вешается на поле `apiKey`, а не на модель: модель выбрана корректно, причина проблемы — пустой ключ. Маркер-константа позволяет хуку отличить это правило от остальных ошибок схемы:

```ts
// src/schemas/api-template.ts
export const MODEL_REQUIRES_API_KEY_MESSAGE = 'Model requires an API key';

export const apiTemplateFormSchema = z
  .object({ name, provider, model, apiKey })
  .superRefine((value, ctx) => {
    if (value.model.trim() !== '' && value.apiKey.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['apiKey'],
        message: MODEL_REQUIRES_API_KEY_MESSAGE,
      });
    }
  });
```

### 3.3 Хук формы: `useTemplateForm.ts`

- `setApiKey`: при реальной смене ключа сбрасывает модель (у нового ключа список другой), снимает ошибку поля и вызывает `cancelKey` — старый in-flight запрос абортится и не перезапишет кэш.
- `useEffect` по `[apiKey, provider]`: если ключ короче `MODELS_MIN_API_KEY_LENGTH` — выход; иначе таймер на `MODELS_FETCH_DEBOUNCE_MS`, по истечении — `ensureModels`. Повторный ввод того же ключа повторного запроса не делает (кэш стора).
- `handleAdd`: при ошибке схемы ищет issue с `path: ['apiKey']` и маркерным сообщением — подсвечивает поле (`apiKeyError`) и показывает тост `apiTab.keyRequired`; остальные ошибки схемы — общий `invalidForm`. Логика сохранения (UNIQUE(name) → `duplicateName`) не изменилась.

## 4. UI

**`ModelSelect`** (`src/shared/components/ModelSelect/`) — переиспользуемый выбор модели, встроен в `TemplateForm.tsx` вместо бывшего `TextInput` модели. Компонент получает `provider`, `apiKey`, `value`, `onChange` и сам решает, что показывать:

- **`status === 'loading'`** — строка со спиннером «Загрузка моделей...».
- **Списка нет** (ошибка, пустой ответ, ещё не запрашивался) — молча деградирует в обычный `TextInput` ручного ввода имени модели. Фича никогда не блокирует создание шаблона.
- **Список есть** — `Pressable`-поле с текущим значением и шевроном; при пустом ключе или `disabled` дропдаун не открывается (opacity-50). Открытие — `Modal` с поиском (`filterModels`: case-insensitive подстрока) и `FlatList` (виртуализация на длинных списках, `MODEL_LIST_MAX_HEIGHT`); выбранная модель подсвечена `bg-accent`; тап вне карточки закрывает.

```tsx
// src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx
<ModelSelect
  baseUrl={API_TEMPLATE_PRESETS[provider].baseUrl}
  provider={provider}
  apiKey={apiKey}
  value={model}
  onChange={setModel}
/>
```

Поле ключа при `apiKeyError` получает `border-accent`. Строки i18n: `apiTab.keyRequired` и секция `modelSelect.*` (ru/en).

## 5. Поток данных

**Авто-загрузка списка моделей:**
```
Ввод ключа в TextInput
  ↓
setApiKey(text) — ключ изменился?
  ├── setModel("") — модель сброшена
  └── useModelsStore.cancelKey(provider, старый ключ) — аборт in-flight
  ↓
useEffect [apiKey, provider]: длина ≥ 20?
  ↓ таймер 700мс (сбрасывается каждым новым вводом)
useModelsStore.ensureModels(provider, baseUrl, apiKey)
  ├── запись ready/loading уже есть → выход (кэш)
  └── fetchAvailableModels → GET {baseUrl}/models, Bearer, таймаут 15s
        ↓ normalizeModelList(payload) → string[] отсортированный
  ↓ (защита: контроллер ещё актуален?)
entries[key] = { status: 'ready', models }
  ↓
ModelSelect перерисовывается: TextInput → дропдаун
```

**Выбор модели:**
```
Тап по полю (ключ непустой)
  ↓ setIsOpen(true), query = ""
Ввод в поиск → filterModels(models, query) → FlatList
  ↓ тап по модели
onChange(item) → setModel → setIsOpen(false)
```

**Сохранение шаблона:**
```
handleAdd → apiTemplateFormSchema.safeParse(...)
  ├── model ≠ "" && apiKey = "" → issue на apiKey
  │     → apiKeyError = true (красная рамка) + тост «Сначала введите ключ»
  └── ok → addTemplate(...) → тост об ошибке при отказе вставки
```

## 6. Почему так, а не иначе

1. **Стор-кэш, а не состояние в хуке формы.** Список моделей зависит от пары (провайдер, ключ) и нужен в одном месте, но кэш в хуке умирал бы при размонтировании формы — повторное открытие формы с тем же ключом делало бы повторный сетевой запрос. Стор переживает размонтирование, а `ensureModels` с дедупликацией делает вызов из любого места безопасным.

2. **Ошибки результатом, а не исключением.** `unauthorized` (невалидный ключ — нормальный сценарий ввода) и `network` (нет сети) — ожидаемые исходы, а не аварии. Классификация в `FetchModelsResult` позволяет UI молча деградировать в ручной ввод, не завязываясь на тексты исключений.

3. **Деградация в TextInput вместо показа ошибки.** Если провайдер не отдал список (нестандартный ответ, лимиты), форма всё равно должна работать как раньше — ручной ввод. Ошибка загрузки списка не блокирует создание шаблона и не требует отдельного UI-состояния.

4. **superRefine в схеме, а не if в хуке.** Схема — единственная точка валидации формы; правило «модель требует ключ» — инвариант данных, а не логика UI. Маркер-константа нужна только потому, что zod не даёт типизированных кодов кастомных правил.

5. **`normalizeModelList` отдельным файлом.** `models.ts` импортирует `expo/fetch` и не запускается в node-тестах; чистая нормализация вынесена, чтобы тестировать её без эмуляции Expo.

## Преимущества

- ✅ Модель выбирается из реального списка провайдера — опечатки и устаревшие id исключены
- ✅ Поиск по списку и виртуализация: длинные каталоги (OpenRouter) скроллятся без лагов
- ✅ Кэш на сессию: повторное открытие формы с тем же ключом — без повторного запроса
- ✅ Гонки закрыты: смена ключа абортит старый запрос, устаревший ответ не перезаписывает кэш
- ✅ Молчаливая деградация: любая ошибка списка возвращает форму к ручному вводу, фича не блокирует ничего
- ✅ Явная валидация «модель без ключа» с подсветкой поля и тостом вместо молчаливого сохранения битого шаблона
- ✅ Переиспользовано существующее: пресеты провайдеров, паттерн стора, тосты, i18n — новый код только в shared-слое
