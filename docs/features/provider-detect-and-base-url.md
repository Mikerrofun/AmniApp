# Автоопределение провайдера и валидация baseUrl

---

**Дата:** 15.11.2026
**Теги:** #features #api-templates #provider-detect #forms #refactoring

---

## 1. Зачем

При создании шаблона API пользователю раньше приходилось самому знать и
вбивать provider и baseUrl — а это два значения, которые можно вывести
автоматически: префикс ключа (`sk-ant-`, `gsk_`, `AIza`…) однозначно (или
почти однозначно) указывает провайдера, а baseUrl у каждого провайдера
свой фиксированный. Оставшийся случай — ключ с нераспознанным префиксом
или самописный OpenAI-совместимый эндпоинт — покрывается ручным вводом
baseUrl с обязательной проверкой, что эндпоинт вообще отвечает в
OpenAI-формате, иначе шаблон сохранится и молча не заработает в чате.

Вторая причина — система разрослась с дубликатами: две параллельные
механики валидации baseUrl (авто и ручная) делали одно и то же разными
путями, zod-enum провайдеров дублировал TypeScript-юнион, а `lib/ai`
превратился в свалку из 17 файлов в одной папке. Рефакторинг свёл всё к
одному механизму валидации, одному источнику id провайдеров и двум
подпапкам с ясной навигацией.

## 2. Где/что уже было

Задача во многом была «собрать из готового», новое писалось только там,
где пусто:

- **`PROVIDER_REGISTRY`** (`shared/config/providers.config.ts`) — реестр
  провайдеров: `id`, `label`, `baseUrl`, `prefixes`. Единственный источник
  правды: из него теперь берется и детект, и zod-схема, и лейблы.
- **`fetchAvailableModels`** — нативный `expo/fetch` `GET {baseUrl}/models`
  с Bearer, таймаут, классификация ошибок в результат (не исключения).
  Используется и как список моделей, и как probe совместимости.
- **Паттерн zustand-стора с in-memory кэшем** — как в `search-store` /
  `templates-store`: стор держит только сериализуемое состояние,
  `AbortController` живут рядом в модуле.
- **`API_TAB_ANIMATION`** (`app/(tabs)/api/components/api-tab.animation.ts`)
  — общие тайминги формы и списка; анимации появления/скрытия baseUrl
  взяты оттуда же, новые тайминги не вводились.
- **`showToast`** и **`useT`** — существующие механизмы ошибок и i18n.

## 3. Реализация

### 3.1 Слои provider-detect: логика → кэш → хук

Система разбита на три файла с жестким разделением ответственности
(подробный разбор — раздел 6.6):

```ts
// src/shared/lib/ai/provider-detect/provider-detect.ts
// Чистая логика без React и стора — тестируется в node как есть.

/** Длина самого длинного префикса провайдера, совпавшего с ключом */
const matchedPrefixLength = (provider: ApiProviderConfig, key: string): number =>
  provider.prefixes.reduce(
    (max, prefix) =>
      key.startsWith(prefix.toLowerCase())
        ? Math.max(max, prefix.length)
        : max,
    0,
  );

/**
 * matchProviders(apiKey) → ApiProviderConfig[]
 * Longest-prefix match по реестру, регистр не важен. Выигрывает самый
 * длинный сработавший префикс; кандидаты равной длины остаются все —
 * так выживает коллизия `sk-` (OpenAI и DeepSeek).
 */
export function matchProviders(apiKey: string): ApiProviderConfig[] { ... }

/**
 * resolveProvider(apiKey, fetchModels, signal?) → ProviderDetectResult
 * 0 кандидатов или ключ короче PROVIDER_DETECT_MIN_KEY_LENGTH → 'unknown';
 * 1 кандидат → 'resolved' без единого запроса; коллизия — параллельный
 * probe `GET {baseUrl}/models` каждому кандидату, побеждает первый
 * успешный (firstFulfilled), все неуспешны → 'failed'.
 * Фетчер передается параметром — в тестах подставляется фейковый.
 */
export async function resolveProvider(
  apiKey: string,
  fetchModels: ModelsFetcher,
  signal?: AbortSignal,
): Promise<ProviderDetectResult> { ... }

/**
 * firstFulfilled(promises) → Promise<T | null>
 * Аналог Promise.any без Promise.any: Hermes его не гарантирует.
 * Первый fulfilled побеждает, все rejected → null.
 */
```

```ts
// src/shared/lib/ai/provider-detect/provider-detect-store.ts
// Zustand-кэш результатов детекта по ключу, in-memory на сессию.

export const useProviderDetectStore = create<ProviderDetectState>((set, get) => ({
  entries: {}, // ключ записи — apiKey

  /**
   * ensureDetect(apiKey, signal?) — обеспечивает результат:
   * запись уже есть (в любом статусе) → выход, второй probe не идет
   * (in-flight дедупликация); иначе ставит 'detecting', вызывает
   * resolveProvider и записывает финальный статус. Ответ от старого
   * ключа не перезаписывает новую запись: контроллер сверяется с картой.
   */
  ensureDetect: async (apiKey, signal) => { ... },

  /** cancelKey(apiKey) — абортит in-flight probe и удаляет запись кэша */
  cancelKey: (apiKey) => { ... },
}));

// Контроллеры in-flight probe — несериализуемое состояние вне стора
const inFlightControllers = new Map<string, AbortController>();
```

```ts
// src/shared/lib/ai/provider-detect/use-provider-detect.ts
// React-клей: debounce, отмена при смене ключа, подписка на стор.

/**
 * useProviderDetect(apiKey) → { status, provider?, baseUrl? }
 * После остановки ввода ключа (PROVIDER_DETECT_DEBOUNCE_MS = 1000)
 * запускает ensureDetect; при смене ключа cancelKey(previous) абортит
 * старый probe. Повторная вставка того же ключа берется из кэша стора —
 * запроса нет. Типизация результата — в use-provider-detect.types.ts.
 */
export function useProviderDetect(apiKey: string): UseProviderDetectResult
```

### 3.2 Единая валидация baseUrl — useBaseUrlValidation

Главный результат рефакторинга: раньше авто-режим (детект → стор) и
ручной режим (отдельный useEffect с probe) были двумя параллельными
механиками, которые «делают одно и то же, но сохраняют разное». Теперь
один хук обслуживает оба режима:

```ts
// src/shared/lib/ai/provider-detect/use-base-url-validation.ts

/**
 * useBaseUrlValidation({ mode, apiKey, manualBaseUrl? })
 *   → { status: 'idle' | 'ok' | 'fail', baseUrl: string }
 *
 * mode: 'auto'   — делегирует useProviderDetect: resolved → ok + baseUrl
 *                  из реестра; unknown/failed → fail; остальное → idle.
 * mode: 'manual' — после остановки ввода (тот же debounce 1000 мс)
 *                  probe ручного baseUrl через fetchAvailableModels.
 *                  Неуспех (401/403/сеть/не-OpenAI-формат) → fail.
 */
export function useBaseUrlValidation({
  mode,
  apiKey,
  manualBaseUrl = '',
}: UseBaseUrlValidationParams): UseBaseUrlValidationResult
```

Ключевой прием — статус ключуется парой входов, а не сбрасывается
вручную:

```ts
// src/shared/lib/ai/provider-detect/use-base-url-validation.ts
// Статус probe принадлежит конкретной паре «baseUrl|ключ»: смена любого
// слагаемого мгновенно возвращает idle без set-state в теле эффекта
const probeKey = `${manualBaseUrl.trim()}|${apiKey.trim()}`;
const [probe, setProbe] = useState<{
  key: string;
  status: UseBaseUrlValidationResult['status'];
} | null>(null);

// наружу отдается статус только если он про текущие входы:
status: probe?.key === probeKey ? probe.status : 'idle',
```

Промежуточного статуса «проверяем» больше нет — он был нужен только для
текста в UI, которого больше тоже нет (раздел 6.1).

### 3.3 models-fetcher: одна точка сети + нативные фетчеры + парсеры

Вся сеть получения списков моделей — в одной подпапке:

```
src/shared/lib/ai/models-fetcher/
├── models-fetcher.config.ts    # таймаут, дебаунс, GEMINI/COHERE URL
├── models-fetcher.types.ts     # FetchModelsResult, ModelsFetcher, ...
├── models-fetcher.ts           # фетчеры + реестр
├── models-store.ts             # кэш списков моделей
├── models-store.types.ts
├── index.ts                    # бочка для внешних импортов
└── parsers/                    # чистые парсеры, тестируются без expo/fetch
    ├── parse-openai-models.ts      # data[].id, срез «~»/«~/»
    ├── parse-anthropic-models.ts   # data[].id
    ├── parse-gemini-models.ts      # models[].name, срез «models/»
    └── parse-cohere-models.ts      # models[].name
```

```ts
// src/shared/lib/ai/models-fetcher/models-fetcher.ts

/**
 * fetchAvailableModels({ baseUrl, apiKey, signal? })
 *   → { ok: true, models: string[] } | { ok: false, reason }
 * Дефолтный OpenAI-совместимый фетчер: GET {baseUrl}/models с Bearer.
 * 401/403 → 'unauthorized', TypeError без аборта → 'network', остальное
 * → 'other'. Один AbortController совмещает внешний сигнал и таймаут.
 */
export async function fetchAvailableModels(...): Promise<FetchModelsResult>

/**
 * Нативные фетчеры провайдеров, чей список моделей не гарантированно
 * лежит в OpenAI-формате:
 *   fetchAnthropicModels — GET {baseUrl}/models, x-api-key + anthropic-version
 *   fetchGeminiModels    — GET v1beta/models?key=... (ключ в query)
 *   fetchCohereModels    — GET /v1/models, Bearer, формат models[].name
 * URL Gemini/Cohere вынесены в models-fetcher.config.ts.
 */

/** Реестр: provider id → фетчер; неизвестный id — дефолтный OpenAI */
export const MODELS_FETCHERS: Record<string, ModelsFetcher> = {
  anthropic: fetchAnthropicModels,
  gemini: fetchGeminiModels,
  cohere: fetchCohereModels,
};

export const getModelsFetcher = (providerId: string): ModelsFetcher =>
  MODELS_FETCHERS[providerId] ?? fetchAvailableModels;
```

```ts
// src/shared/lib/ai/models-fetcher/models-store.ts
// Кэш списков моделей, ключ записи — modelsCacheKey(baseUrl, apiKey).

/**
 * ensureModels(provider, baseUrl, apiKey) — ready/loading → выход
 * (дедупликация), иначе фетчер из getModelsFetcher(provider) и запись
 * ready/error. Ответ от смененного ключа не перезаписывает новую запись.
 * cancelKey(baseUrl, apiKey) — аборт + удаление записи.
 */
export const useModelsStore = create<ModelsState>(...)
```

### 3.4 Схема валидации: enum из реестра + условное правило

```ts
// src/schemas/api-template.ts

/**
 * Провайдеры выводятся из PROVIDER_REGISTRY — единственного источника id.
 * Раньше здесь лежал hand-written z.enum из 10 строк, дублирующий
 * TypeScript-юнион ApiTemplateProvider; теперь дубликата нет.
 */
const providerIds = PROVIDER_REGISTRY.map((provider) => provider.id) as [
  ApiTemplateProvider,
  ...ApiTemplateProvider[],
];

export const apiTemplateProviderSchema = z.enum(providerIds);

/** База: все поля обязательны, baseUrl — пустая строка либо валидный URL */
export const apiTemplateFormSchema = z.object({ ... });

/**
 * createApiTemplateFormSchema({ baseUrlRequired }) — фабрика схемы:
 * пока детект не resolved, baseUrl обязателен (superRefine добавляет
 * issue на поле baseUrl при пустой строке). Сам probe совместимости
 * схема не делает — его выполняет useBaseUrlValidation, к сабмиту
 * форма попадает только с уже проверенным baseUrl.
 */
export function createApiTemplateFormSchema({
  baseUrlRequired,
}: {
  baseUrlRequired: boolean;
}) { ... }
```

### 3.5 Форма: useTemplateForm

```ts
// src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts

/**
 * useTemplateForm() — вся логика формы, компонент только рендерит.
 * Ключевые производные значения (каждое отвечает ровно на один вопрос):
 *   isManual        — показывать ли ручной ввод baseUrl
 *                     (detect.status === 'unknown' | 'failed')
 *   providerId      — 'custom' или id из детекта (для схемы и стора)
 *   resolvedBaseUrl — проверенный baseUrl из useBaseUrlValidation
 *   baseUrlReady    — status === 'ok' (разрешает сабмит и ModelSelect)
 */
const detect = useProviderDetect(apiKey);
const isManual = detect.status === "unknown" || detect.status === "failed";
const { status: baseUrlStatus, baseUrl: validatedBaseUrl } =
  useBaseUrlValidation({
    mode: isManual ? "manual" : "auto",
    apiKey,
    manualBaseUrl: isManual ? manualBaseUrl : undefined,
  });

/**
 * setApiKey(text) — при реальной смене ключа: сбрасывает модель, абортит
 * in-flight запрос списка моделей (cancelKey) и очищает ручной baseUrl —
 * новый ключ это новая попытка детекта.
 */
```

`handleAdd` не изменился по структуре: `safeParse` фабричной схемы →
`addTemplate(name, provider, baseUrl, model, apiKey)` → поля гаснут
(`isClearing`), очищаются невидимыми и возвращаются; ошибка `UNIQUE` —
тост про дубликат имени, остальное — `saveFailed`.

### 3.6 Что еще почистено

- i18n: из `en.json`/`ru.json` удалены `detecting`, `detectFailed`,
  `checkingBaseUrl`, `baseUrlNotCompatible` — статусы больше не тексты.
- Тесты: `provider-detect.test.ts` (matchProviders/resolveProvider,
  фейковый фетчер вместо expo/fetch), `parse-openai-models.test.ts`
  (бывший normalize-models), `api-template-validation.test.ts`.
- Импорты снаружи идут через бочки `@/shared/lib/ai/models-fetcher` и
  `@/shared/lib/ai/provider-detect`; тесты берут глубокие пути, чтобы не
  тянуть `expo/fetch` в node.

## 4. UI

`TemplateForm.tsx` — изменений три, остальной рендер не тронут:

```tsx
// src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx

// Лейбл распознанного провайдера — плавное появление/исчезание
{providerLabel && (
  <Animated.View
    entering={FadeInUp.duration(API_TAB_ANIMATION.listEnter)}
    exiting={FadeOut.duration(API_TAB_ANIMATION.listExit)}
  >
    <Text className="pt-4 text-sm text-text-primary">{providerLabel}</Text>
  </Animated.View>
)}

{/* Ручной ввод baseUrl появляется, только когда провайдер по ключу
    не определен; вход/выход — теми же анимациями, что у списка */}
{isManual && (
  <Animated.View
    entering={FadeInUp.duration(API_TAB_ANIMATION.listEnter)}
    exiting={FadeOut.duration(API_TAB_ANIMATION.listExit)}
  >
    <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
      {t("apiTab.baseUrl")}
    </Text>
    <TextInput
      value={manualBaseUrl}
      onChangeText={setManualBaseUrl}
      keyboardType="url"
      placeholder={t("apiTab.baseUrlPlaceholder")}
      ...
    />
  </Animated.View>
)}
```

Убраны: строка «Detecting provider...» (прыжки UI, пользы ноль) и все
статусные тексты под полем baseUrl. Под полем не осталось ни одного
условного текста — обратная связь только через кнопку: серая, пока
`canSubmit === false`.

## 5. Поток данных

Авто-режим (ключ распознался):

```
Вставка ключа
↓ setApiKey → сброс model/manualBaseUrl, cancelKey старого запроса
↓ useProviderDetect: debounce 1000 мс → ensureDetect(apiKey)
↓ resolveProvider → matchProviders (longest-prefix по PROVIDER_REGISTRY)
↓ 1 кандидат → resolved без запроса | коллизия → параллельный probe
   fetchAvailableModels каждому → firstFulfilled → победитель
↓ provider-detect-store: entries[apiKey] = { status, providerId, baseUrl }
↓ useBaseUrlValidation(auto): resolved → { status: 'ok', baseUrl }
↓ useTemplateForm: baseUrlReady = true → canSubmit
↓ debounce MODELS_FETCH_DEBOUNCE_MS → ensureModels(providerId, baseUrl, apiKey)
↓ getModelsFetcher(providerId) → fetch → parser → models-store ready
↓ ModelSelect показывает список → handleAdd → safeParse → addTemplate → БД
```

Ручной режим (префикс не распознан / probe коллизии неуспешен):

```
detect.status = unknown | failed
↓ isManual = true → Animated.View с полем baseUrl (FadeInUp)
↓ ввод baseUrl → useBaseUrlValidation(manual): debounce 1000 мс
↓ fetchAvailableModels({ baseUrl, apiKey }) — probe совместимости
↓ ok → probe{key, status:'ok'} → baseUrlReady → canSubmit
↓ fail → probe{key, status:'fail'} → кнопка остается серой
↓ смена ввода → probeKey изменился → статус мгновенно idle (без эффекта)
```

## 6. Сложные темы — разбор

### 6.1 Статусы и состояния: почему именно так

Итоговая система — два независимых статуса для двух разных вопросов:

| Статус | Где живет | На какой вопрос отвечает |
| --- | --- | --- |
| `ProviderDetectStatus` = idle / detecting / resolved / unknown / failed | provider-detect-store, запись по apiKey | «Что мы знаем об этом ключе?» |
| `BaseUrlValidationStatus` = idle / ok / fail | useBaseUrlValidation | «Можно ли уже сабмитить с этим baseUrl?» |

- **Зачем `detecting` во внутреннем статусе, если его не видно?** Это не
  UI-статус, а флаг in-flight дедупликации: пока probe летит, повторный
  `ensureDetect` с тем же ключом видит запись и не запускает второй
  запрос. Убрать его — либо потерять дедуп, либо завести отдельную карту
  «летящих» ключей рядом со стором.
- **Зачем `idle`, от чего он защищает?** `idle` = «для текущих входов
  валидного вердикта нет». Без него после `ok` пользователь мог бы
  отредактировать baseUrl, а статус остался бы `ok` от старой пары —
  и сабмит разблокировался бы для непроверенного эндпоинта. Ключевание
  статуса парой «baseUrl|ключ» (раздел 3.2) делает idle автоматическим:
  входы изменились → старый вердикт больше не про эти входы.
- **Нужен ли `loading`/`probing`?** Нет, и он удален. Промежуточный
  статус был нужен ровно для одного — показать текст «Checking
  endpoint...». Текст убрали, значит и статус не нужен: `canSubmit`
  достаточно различать «ok» и «все остальное». Правило: статус существует
  только если на нем ветвится логика, а не «чтобы было видно, что что-то
  происходит».

### 6.2 Дублирование логики: что осталось и почему это не дубликат

- **baseUrlProbe vs detectStatus** — были двумя механизмами, стали одним:
  `useBaseUrlValidation` с параметром `mode`. Оба режима валидируют пару
  «baseUrl + ключ» и отдают `{ status, baseUrl }`; разница только в
  источнике baseUrl (реестр vs ручной ввод).
- **isManual / baseUrlReady / providerId / resolvedBaseUrl** — это не
  дублирующая логика, а производные значения, каждое с одним
  потребителем: `isManual` → рендер поля и `baseUrlRequired` схемы,
  `baseUrlReady` → `canSubmit` и `disabled` у ModelSelect, `providerId` →
  схема и выбор фетчера, `resolvedBaseUrl` → ModelSelect и схема. Ни
  одно не вычисляется дважды и ни одно не дублирует другое.
- **getProviderConfig vs getProviderLabel** — разные контракты, а не
  дубликат: `getProviderConfig(id)` возвращает полный конфиг (нужен
  логике: baseUrl, prefixes) и `undefined` для неизвестного id; 
  `getProviderLabel(id)` возвращает строку для отображения и падает
  обратно на сам `id` — старые записи БД с неизвестным провайдером
  должны показывать хоть что-то, а не ломать UI.

### 6.3 Валидация: createApiTemplateFormSchema({ baseUrlRequired })

Фабрика, а не два отдельных схемы-объекта, потому что правила полей
(name/model/apiKey/provider) общие, а условное ровно одно — обязательность
baseUrl в ручном режиме. `superRefine` добавляет issue на `baseUrl` только
когда `baseUrlRequired && baseUrl === ''`. Важно: схема проверяет форму,
но не совместимость эндпоинта — к моменту сабмита probe уже пройден
(`canSubmit` не пустит раньше), схема здесь последний рубеж, а не
механизм проверки.

### 6.4 Models fetchers: зачем тип и зачем парсеры

- **Почему не один `fetchAvailableModels` на всех?** Anthropic, Gemini и
  Cohere не гарантируют OpenAI-формат списка моделей: у Anthropic свой
  заголовок `x-api-key` + `anthropic-version`, у Gemini ключ ходит в
  query (`?key=`), у Cohere другой путь и формат ответа. Один фетчер
  означал бы либо три запроса «наугад», либо if-ы по провайдеру внутри
  сетевой функции.
- **Зачем тогда тип `ModelsFetcher`?** Единая сигнатура
  `(params) → Promise<FetchModelsResult>` позволяет: (а) `resolveProvider`
  probe-ить любого кандидата одним вызовом, не зная его особенностей;
  (б) `models-store` выбирать фетчер по id через `getModelsFetcher`;
  (в) тестам подставлять фейковый фетчер — node-тесты не видят expo/fetch.
- **Парсеры — «просто привести к string[]»?** Да, и это цель, а не
  упрощение: остальное приложение (шаблон, чат-запрос, фильтр) говорит
  только на `string[]`. Вся специфика провайдера (формат ответа, префиксы
  `models/` у Gemini, мусорный `~` у некоторых OpenAI-совместимых)
  умирает внутри парсера; наружу — отсортированный dedup-список id.

### 6.5 Provider detection: matchProviders и firstFulfilled

- **matchProviders ключ не режет.** Он приводит ключ к нижнему регистру и
  для каждого провайдера реестра проверяет `key.startsWith(prefix)`,
  запоминая длину самого длинного совпавшего префикса. Дальше: совпал
  один — он ответ; совпало несколько — остаются только кандидаты с
  максимальной длиной префикса (`sk-or-v1-` бьет `sk-or-`, `sk-ant-` бьет
  `sk-`); равная длина — остаются все (коллизия `sk-`: OpenAI и DeepSeek).
  «Чем длиннее совпадение, тем специфичнее провайдер» — вся эвристика.
- **firstFulfilled — это race с семантикой Promise.any.** При коллизии
  префиксов каждому кандидату параллельно отправляется probe
  `GET {baseUrl}/models` с одним и тем же ключом; побеждает первый
  успешный ответ — сервер, который принял ключ, и есть провайдер.
  Своя реализация вместо `Promise.any`: Hermes не гарантирует его
  наличие; семантика — «первый fulfilled, все rejected → null» (→
  статус `failed`).

### 6.6 Архитектура: три части provider-detect

```
provider-detect.ts          чистая логика: matchProviders, resolveProvider
        ↓ вызывает
provider-detect-store.ts    zustand: кэш по apiKey, дедуп, аборт
        ↓ читает/запускает
use-provider-detect.ts      React: debounce, cancelKey при смене, подписка
```

Зачем три слоя, а не один хук:

- **Чистая логика** не знает ни про React, ни про стор — она тестируется
  в node (`provider-detect.test.ts`) с фейковым фетчером, без моков
  React и expo.
- **Стор** переживает размонтирование компонента: кэш на сессию общий для
  всех, кто вставит тот же ключ; повторная вставка — ноль запросов.
  Несериализуемое (AbortController) живет рядом с стором, не в нем.
- **Хук** — единственное место, знающее про жизненный цикл React:
  debounce ввода, отмена при смене ключа, подписка через
  `useProviderDetectStore(selector)`. Компоненты не трогают стор напрямую.

Тот же трехслойный шаблон повторяет models-fetcher: чистые парсеры →
стор-кэш → использование в хуках формы/селекта.

## 7. Почему так, а не иначе

1. **Один хук валидации с `mode`, а не два хука.** Оба режима отвечают на
   один вопрос («эта пара baseUrl+ключ рабочая?») и отличаются только
   источником baseUrl; два хука гарантированно разъехались бы — как и
   разъехались до рефакторинга.
2. **Статус ключуется входами, а не сбрасывается эффектами.** Сброс
   `setStatus('idle')` в теле эффекта — гонка с линтом и лишние рендеры;
   сравнение `probe.key === probeKey` дает тот же результат декларативно.
3. **Enum из реестра, а не константа-дубликат.** Реестр и так источник
   детекта и лейблов; третий список тех же строк — третий место, где
   можно забыть новый провайдер.
4. **Анимации из `API_TAB_ANIMATION`, а не новые тайминги.** Появление
   baseUrl — то же событие масштаба, что вход элемента списка; единые
   тайминги держат вкладку визуально цельной и не добавляют конфиг.

## Преимущества

- ✅ Пользователь вводит только имя, модель и ключ — провайдер и baseUrl
  выводятся из префикса ключа; ручной ввод включается сам, когда детект
  не справился.
- ✅ Непроверенный baseUrl невозможно сохранить: сабмит заблокирован до
  успешного probe, схема дублирует правило на последнем рубеже.
- ✅ Одна механика валидации на оба режима — статус и baseUrl приходят из
  одного места, рассинхрон невозможен.
- ✅ Минимум статусов: каждый ветвит логику, ни один не существует ради
  текста в UI.
- ✅ `lib/ai` читается с одной папки: `models-fetcher/` — сеть списков
  моделей, `provider-detect/` — определение провайдера; снаружи — бочки.
- ✅ Чистая логика (детект, парсеры) тестируется в node без React и
  expo/fetch — 26/26 тестов, линт и tsc чистые.
