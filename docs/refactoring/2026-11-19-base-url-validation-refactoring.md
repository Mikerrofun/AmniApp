---

**Дата:** 19.11.2026
**Теги:** #refactoring #api-templates #provider-detect #forms

---

# Единая валидация baseUrl + models из probe + всегда видимое поле

## Обзор изменений

- **models-fetcher** — добавлен fallback-probe `POST /chat/completions` и действие `receiveModels`: готовый список моделей кладется в кеш стора без повторного запроса.
- **provider-detect** — `resolveProvider` принимает резолвер фетчеров по provider id; победитель коллизии возвращает свои models, стор сразу пишет их в models-store.
- **useBaseUrlValidation** — параметр `mode` убран: один механизм «доверие / probe» для любого происхождения baseUrl, результат дополнен флагом `modelsAvailable`.
- **useTemplateForm + TemplateForm** — поле baseUrl одно и всегда видимо с авто-префиллом из реестра; сверка выбранной модели со списком; второй debounce перед запросом моделей удален.

---

## Часть 1: models-fetcher — fallback-probe и прием моделей в стор

### Проблема(ы)

**Проблема 1:** единственным способом проверить совместимость endpoint был `GET /models`. Endpoints, которые умеют только `POST /chat/completions` (списка моделей не отдают), помечались как несовместимые, хотя чат на них работает.

**Проблема 2:** когда список моделей уже получен probe (коллизия при детекте, ручной baseUrl), следующий вызов `ensureModels` делал бы тот же запрос второй раз — некуда было положить готовый результат.

### Решения

#### 1.1. probeChatCompletions

**Файл:** `src/shared/lib/ai/models-fetcher/models-fetcher.ts`

```ts
// src/shared/lib/ai/models-fetcher/models-fetcher.ts
export async function probeChatCompletions({
  baseUrl,
  apiKey,
  signal,
}: FetchAvailableModelsParams): Promise<ProbeChatCompletionsResult> {
  // ... тот же паттерн AbortController + таймаут + внешний signal ...
  const response = await fetch(`${baseUrl}${CHAT_COMPLETIONS_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: CHAT_COMPLETIONS_PROBE_BODY,
    signal: controller.signal,
  });

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "unauthorized" };
  }

  return response.status === 200
    ? { ok: true }
    : { ok: false, reason: "other" };
}
```

**Логика:** fallback-проверка совместимости endpoint без `GET /models`. Успех — строго HTTP 200, тело не валидируется (осознанное решение: чату достаточно статуса). Классификация ошибок повторяет `fetchAvailableModels`: 401/403 → `unauthorized`, прочий не-200 → `other`, сеть/таймаут/аборт — по образцу `fetchProviderJson`. Dummy-тело и суффикс пути — в `models-fetcher.config.ts` (`CHAT_COMPLETIONS_PATH`, `CHAT_COMPLETIONS_PROBE_BODY`), таймаут переиспользован (`MODELS_REQUEST_TIMEOUT_MS`), новый не вводился.

#### 1.2. receiveModels в models-store

**Файл:** `src/shared/lib/ai/models-fetcher/models-store.ts`

```ts
// src/shared/lib/ai/models-fetcher/models-store.ts
receiveModels: (baseUrl, apiKey, models) => {
  const key = modelsCacheKey(baseUrl, apiKey);

  set((state) => ({
    entries: { ...state.entries, [key]: { status: "ready", models } },
  }));
},
```

**Логика:** точка, куда probe кладет уже полученный список моделей. Запись пишется сразу в статусе `ready` по стандартному ключу `baseUrl|apiKey`, поэтому последующий `ensureModels` видит готовую запись и выходит без сетевого запроса — дублирования нет. Сетевой логики в действии нет: это чистая запись в кеш.

---

## Часть 2: provider-detect — фетчер по кандидату + models в результате

### Проблема(ы)

**Проблема 1:** в `resolveProvider` передавался один фетчер на всех кандидатов коллизии. Для anthropic/gemini/cohere это неверно: у них нативные списки моделей (другие заголовки, ключ в query, другой путь) — probe дефолтным OpenAI-фетчером давал ложный fail.

**Проблема 2:** probe коллизии уже скачал список моделей победителя, но выбрасывал его — модели запрашивались повторно через `ensureModels`.

### Решения

#### 2.1. Резолвер фетчеров вместо одного фетчера

**Файл:** `src/shared/lib/ai/provider-detect/provider-detect.ts`

```ts
// src/shared/lib/ai/provider-detect/provider-detect.ts
export async function resolveProvider(
  apiKey: string,
  resolveFetcher: (providerId: string) => ModelsFetcher,
  signal?: AbortSignal,
): Promise<ProviderDetectResult> {
  // ...
  const probes = candidates.map(async (candidate) => {
    const result = await resolveFetcher(candidate.id)({
      baseUrl: candidate.baseUrl,
      apiKey,
      signal,
    });

    if (!result.ok) throw new Error(`probe failed: ${result.reason}`);

    return { candidate, models: result.models };
  });
```

**Логика:** резолвер — фабрика, выдающая каждому кандидату его собственный фетчер (`getModelsFetcher(providerId)`: нативный для anthropic/gemini/cohere, дефолтный OpenAI для остальных). Single-кандидат по-прежнему resolved без единого запроса (`models: []` — список придет через `ensureModels`); коллизия — параллельный probe, `firstFulfilled` выбирает победителя, его models идут в результат. Сигнатура с резолвером сохраняет тестируемость без expo/fetch.

#### 2.2. Модели победителя — сразу в models-store

**Файл:** `src/shared/lib/ai/provider-detect/provider-detect-store.ts`

```ts
// src/shared/lib/ai/provider-detect/provider-detect-store.ts
// Модели победителя коллизии уже получены probe — пишем их в
// models-store, чтобы ensureModels не дублировал запрос. В entry
// детекта models не хранятся: единственный кэш списков — models-store
if (result.status === 'resolved' && result.models.length > 0) {
  useModelsStore
    .getState()
    .receiveModels(result.baseUrl, apiKey, result.models);
}
```

**Логика:** запись выполняется после гвардии «устаревший ответ не перезаписывает новую запись» — порядок проверок сохранен: сначала контроллер сверяется с картой in-flight, потом set стора детекта, потом запись моделей. В entry детекта models не хранятся: единственный кэш списков — models-store, второго источника правды нет.

---

## Часть 3: useBaseUrlValidation — один механизм «доверие / probe»

### Проблема(ы)

**Проблема 1:** параметр `mode: 'auto' | 'manual'` держал в хуке две параллельные ветки, которые «делают одно и то же, но сохраняют разное». После того как поле baseUrl стало всегда видимым и редактируемым, «ручного режима» больше не существует — делить нечего.

**Проблема 2:** результат не говорил, придет ли список моделей: endpoint, прошедший только fallback-проверку, не должен запускать запрос списка.

### Решения

#### 3.1. Trusted-пара вместо mode

**Файл:** `src/shared/lib/ai/provider-detect/use-base-url-validation.ts`

```ts
// src/shared/lib/ai/provider-detect/use-base-url-validation.ts
const trusted =
  detect.status === 'resolved' &&
  detect.baseUrl !== undefined &&
  trimmedBaseUrl === detect.baseUrl;

if (trusted) {
  return { status: 'ok', baseUrl: trimmedBaseUrl, modelsAvailable: true };
}
```

**Логика:** доверие вычисляется из пары входов `(apiKey, baseUrl)`: детект resolved и поле совпадает с реестровым baseUrl → `{ ok, modelsAvailable: true }` без единого запроса (модели придут через `ensureModels`). Параметр `mode` удален из типов — хук сам различает «поле не тронуто» и «поле изменено», вызывающему больше не нужно переключать режимы.

#### 3.2. Каскад probe для не-trusted пары

**Файл:** `src/shared/lib/ai/provider-detect/use-base-url-validation.ts`

```ts
// src/shared/lib/ai/provider-detect/use-base-url-validation.ts
const modelsResult = await getModelsFetcher(detect.provider?.id ?? '')({
  baseUrl: trimmedBaseUrl,
  apiKey,
  signal: controller.signal,
});

if (modelsResult.ok) {
  useModelsStore
    .getState()
    .receiveModels(trimmedBaseUrl, apiKey, modelsResult.models);

  setProbe({ key: probeKey, status: 'ok', modelsAvailable: true });
  return;
}

const chatResult = await probeChatCompletions({ ... });

setProbe({
  key: probeKey,
  status: chatResult.ok ? 'ok' : 'fail',
  modelsAvailable: false,
});
```

**Логика:** не trusted, но оба поля непустые → debounce `PROVIDER_DETECT_DEBOUNCE_MS`, затем каскад: сначала `GET /models` фетчером по provider id из детекта (у resolved-провайдера с измененным baseUrl список может быть нативным; неизвестный id — дефолтный OpenAI-фетчер). Успех → модели сразу в кеш через `receiveModels`, `modelsAvailable: true`. Неудача → fallback `probeChatCompletions`: 200 → `ok, modelsAvailable: false` (ModelSelect останется в ручном вводе модели), иначе `fail`. Ключевание статуса парой «baseUrl|ключ» и аборт in-flight при смене входов/размонтировании сохранены как были.

---

## Часть 4: useTemplateForm + TemplateForm — одно поле, префилл, сверка модели

### Проблема(ы)

**Проблема 1:** в форме было два состояния baseUrl (`manualBaseUrl` + авто из детекта) и условный рендер поля с анимацией появления/исчезания — UI прыгал, а юзер не мог посмотреть/поправить авто-url (прокси, смененный адрес).

**Проблема 2:** выбранная модель не сверялась со списком: после смены baseUrl или ключа в поле могла остаться модель, которой в новом списке нет.

**Проблема 3:** перед запросом моделей стоял второй debounce — в промежутке ничего не проверялось, чистая задержка ~1 с.

### Решения

#### 4.1. Единое поле с авто-префиллом

**Файл:** `src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts`

```ts
// src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts
// Последнее авто-подставленное значение: поле считается «не тронутым
// юзером», пока оно пустое или равно предыдущему авто-значению
const lastAutoBaseUrlRef = useRef("");

useEffect(() => {
  if (detect.status !== "resolved" || !detect.baseUrl) return;

  const current = baseUrl.trim();

  if (current === "" || current === lastAutoBaseUrlRef.current) {
    lastAutoBaseUrlRef.current = detect.baseUrl;
    setBaseUrlState(detect.baseUrl);
  }
}, [detect.status, detect.baseUrl, baseUrl]);
```

**Логика:** поле одно (`baseUrl/setBaseUrl`), рендерится всегда. Авто-детект записывает реестровый baseUrl в поле, пока юзер его не правил (пустое или равно последнему авто-значению — ref отслеживает); отредактированное значение не затирается — оно уйдет в probe хука валидации. `isTrusted` = детект resolved и поле совпадает с `detect.baseUrl`; `baseUrlRequired` для фабрики схемы = `!isTrusted`; `providerId` не меняется при правке baseUrl (решение: провайдер определяется ключом).

#### 4.2. Сверка выбранной модели со списком

**Файл:** `src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts`

```ts
// src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts
const modelsEntry = useModelsStore((state) =>
  state.entries[modelsCacheKey(resolvedBaseUrl, apiKey)],
);
const [prevModelsEntry, setPrevModelsEntry] = useState(modelsEntry);

if (prevModelsEntry !== modelsEntry) {
  setPrevModelsEntry(modelsEntry);

  const selected = model.trim();

  if (
    modelsEntry?.status === "ready" &&
    selected !== "" &&
    !modelsEntry.models.includes(selected)
  ) {
    setModel("");
  }
}
```

**Логика:** когда запись кеша для текущей пары `baseUrl|ключ` стала `ready` и выбранной модели в списке нет — модель очищается. Только очистка, авто-выбор не делается. Корректировка состояния во время рендера при смене записи — рекомендованный React-паттерн вместо `setState` в эффекте (правило `react-hooks/set-state-in-effect`). Покрывает и смену baseUrl, и смену ключа; старые записи кеша не удаляются — возврат к старому baseUrl дает список мгновенно из кеша.

#### 4.3. Запрос моделей без второго debounce

**Файл:** `src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts`

```ts
// src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts
useEffect(() => {
  if (
    !apiKey.trim() ||
    !baseUrlReady ||
    !modelsAvailable ||
    resolvedBaseUrl === ""
  ) {
    return;
  }

  void useModelsStore
    .getState()
    .ensureModels(providerId, resolvedBaseUrl, apiKey);
}, [apiKey, providerId, resolvedBaseUrl, baseUrlReady, modelsAvailable]);
```

**Логика:** запрос списка идет сразу, как только baseUrl проверен и endpoint отдал список (`modelsAvailable` — при fallback-only endpoint запросать список бессмысленно). Второй debounce удален вместе с константой `MODELS_FETCH_DEBOUNCE_MS`: ввод ключа уже отфильтрован debounce детекта, а `ensureModels` дедуплицирует in-flight и кеширует по `baseUrl|apiKey` — повторные срабатывания эффекта запросов не создают.

#### 4.4. UI: поле всегда видно, providerLabel удален

**Файл:** `src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx`

```tsx
// src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx
<Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
  {t("apiTab.baseUrl")}
</Text>
<TextInput
  value={baseUrl}
  onChangeText={setBaseUrl}
  autoCapitalize="none"
  autoCorrect={false}
  keyboardType="url"
  placeholder={t("apiTab.baseUrlPlaceholder")}
  placeholderTextColor={colors.placeholder}
  className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary"
/>
```

**Логика:** блок `providerLabel` (Animated.View с текстом провайдера) удален — текст в форме больше не нужен. Поле baseUrl рендерится без условия `isManual` и без Animated-обертки FadeInUp/FadeOut — появление/исчезание больше не происходит, стили поля не менялись. ModelSelect не тронут: ручной ввод модели при пустом списке уже реализован веткой `!hasList → TextInput`, при `modelsAvailable: false` список просто не придет. i18n-ключи не добавлялись — `apiTab.baseUrl`/`baseUrlPlaceholder` уже существуют.

---

## Итоги

### Изменённые файлы (14 шт)

**models-fetcher:**
1. `src/shared/lib/ai/models-fetcher/models-fetcher.ts` — добавлен `probeChatCompletions` (fallback POST /chat/completions, успех = HTTP 200)
2. `src/shared/lib/ai/models-fetcher/models-fetcher.config.ts` — `CHAT_COMPLETIONS_PATH`, `CHAT_COMPLETIONS_PROBE_BODY`; удален `MODELS_FETCH_DEBOUNCE_MS`
3. `src/shared/lib/ai/models-fetcher/models-fetcher.types.ts` — тип `ProbeChatCompletionsResult`
4. `src/shared/lib/ai/models-fetcher/models-store.ts` — действие `receiveModels`
5. `src/shared/lib/ai/models-fetcher/models-store.types.ts` — тип действия `receiveModels`
6. `src/shared/lib/ai/models-fetcher/index.ts` — экспорт нового API через бочку

**provider-detect:**
7. `src/shared/lib/ai/provider-detect/provider-detect.ts` — `resolveProvider` принимает резолвер фетчеров; победитель коллизии возвращает models
8. `src/shared/lib/ai/provider-detect/provider-detect.types.ts` — `models: string[]` в варианте `resolved`
9. `src/shared/lib/ai/provider-detect/provider-detect-store.ts` — резолвер `getModelsFetcher`, запись моделей в models-store после гвардии
10. `src/shared/lib/ai/provider-detect/use-base-url-validation.ts` — единый механизм «доверие / probe», каскад GET /models → POST /chat/completions
11. `src/shared/lib/ai/provider-detect/use-base-url-validation.types.ts` — `mode`/`manualBaseUrl` убраны, добавлен `modelsAvailable`

**форма:**
12. `src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts` — единое `baseUrl`, префилл через ref, сверка модели, запрос моделей без debounce
13. `src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx` — providerLabel удален, поле baseUrl всегда видно без анимаций

**тесты:**
14. `tests/api-templates/provider-detect.test.ts` — обновлен под резолвер: single-кандидат без запроса, победитель коллизии возвращает свои models

### Результаты

- ✅ Endpoint без `GET /models`, но с рабочим `POST /chat/completions`, больше не помечается несовместимым
- ✅ Список моделей запрашивается ровно один раз на пару `baseUrl|ключ`: probe коллизии и ручного baseUrl пишут готовый результат в models-store, `ensureModels` его подхватывает
- ✅ Probe коллизии идет нативным фетчером каждого кандидата (anthropic/gemini/cohere — корректный auth), а не дефолтным OpenAI-запросом
- ✅ Поле baseUrl всегда видно и редактируемо: авто-значение подставляется, пока поле не тронуто; правка юзера уходит в probe, UI не прыгает
- ✅ Выбранная модель сверяется со списком текущей пары и очищается, если в нем её нет
- ✅ Модели грузятся сразу после resolved — второй debounce перед запросом удален

---

## Принципы, использованные при рефакторинге

- **Один источник правды** — единственный кэш списков моделей это models-store; в entry детекта models не дублируются.
- **Статус существует, только если на нем ветвится логика** — промежуточные статусы не вводились, ключение вердикта парой входов делает idle автоматическим.
- **Переиспользование вместо нового** — таймаут, паттерн AbortController, debounce и гвардия устаревшего ответа взяты из существующего кода; новое писалось только там, где пусто (probe, receiveModels, trusted-ветка).
- **Слои не смешиваются** — типы в `*.types.ts`, константы в `*.config.ts`, логика в чистых модулях, наружу — через бочки `index.ts`.
- **Surgical Changes** — ModelSelect, схема, парсеры и `handleAdd` не переписывались: изменились только точки, затронутые новым потоком данных.
