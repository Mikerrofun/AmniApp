---

**Дата:** 19.11.2026
**Теги:** #refactoring #api-templates #provider-detect #forms #structure

---

# Единая валидация baseUrl + models из probe + всегда видимое поле

## Обзор изменений

- **models-fetcher** — добавлен fallback-probe `POST /chat/completions` и действие `receiveModels`: готовый список моделей кладется в кеш стора без повторного запроса.
- **provider-detect** — `resolveProvider` принимает резолвер фетчеров по provider id; победитель коллизии возвращает свои models, стор сразу пишет их в models-store.
- **useBaseUrlValidation** — параметр `mode` убран: один механизм «доверие / probe» для любого происхождения baseUrl, результат дополнен флагом `modelsAvailable`.
- **useTemplateForm + TemplateForm** — поле baseUrl одно и всегда видимо с авто-префиллом из реестра; сверка выбранной модели со списком; второй debounce перед запросом моделей удален.
- **paste-детект** — вставка/автозаполнение распознаются по переходу значения и запускают детект и probe без debounce; посимвольный ввод фильтруется debounce как раньше.
- **структура** — `models-fetcher` и `provider-detect` разбиты на подпапки по ответственности; эвристика вставки вынесена в `shared/lib/input`.

---

## Часть 1: models-fetcher — fallback-probe и прием моделей в стор

### Проблема(ы)

**Проблема 1:** единственным способом проверить совместимость endpoint был `GET /models`. Endpoints, которые умеют только `POST /chat/completions` (списка моделей не отдают), помечались как несовместимые, хотя чат на них работает.

**Проблема 2:** когда список моделей уже получен probe (коллизия при детекте, ручной baseUrl), следующий вызов `ensureModels` делал бы тот же запрос второй раз — некуда было положить готовый результат.

### Решения

#### 1.1. probeChatCompletions

**Файл:** `src/shared/lib/ai/models-fetcher/fetchers/models-fetcher.ts`

```ts
// src/shared/lib/ai/models-fetcher/fetchers/models-fetcher.ts
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

**Файл:** `src/shared/lib/ai/models-fetcher/store/models-store.ts`

```ts
// src/shared/lib/ai/models-fetcher/store/models-store.ts
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

**Файл:** `src/shared/lib/ai/provider-detect/detect/provider-detect.ts`

```ts
// src/shared/lib/ai/provider-detect/detect/provider-detect.ts
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

**Файл:** `src/shared/lib/ai/provider-detect/store/provider-detect-store.ts`

```ts
// src/shared/lib/ai/provider-detect/store/provider-detect-store.ts
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

**Файл:** `src/shared/lib/ai/provider-detect/hooks/use-base-url-validation.ts`

```ts
// src/shared/lib/ai/provider-detect/hooks/use-base-url-validation.ts
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

**Файл:** `src/shared/lib/ai/provider-detect/hooks/use-base-url-validation.ts`

```ts
// src/shared/lib/ai/provider-detect/hooks/use-base-url-validation.ts
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

## Часть 5: paste-детект — вставка без debounce

### Проблема(ы)

**Проблема 1:** debounce детекта (1000 мс) ждал и после вставки готового ключа — вставка не требует фильтрации ввода, это чистая секунда задержки до resolved и списка моделей.

**Проблема 2:** то же для probe baseUrl: вставка нового ключа при отредактированном baseUrl или вставка самого baseUrl заново ждали debounce, хотя значение уже финальное.

### Решения

#### 5.1. Эвристика isPasteLikeInsertion

**Файл:** `src/shared/lib/input/paste-detection.ts`

```ts
// src/shared/lib/input/paste-detection.ts
export function isPasteLikeInsertion(
  previous: string,
  next: string,
): boolean {
  if (next.length > previous.length + 1) return true;
  if (next.length === previous.length) return false;

  return !next.startsWith(previous) && !previous.startsWith(next);
}
```

**Логика:** в React Native у TextInput нет события `onPaste`, а чтение буфера обмена требует разрешений и системного диалога на iOS — поэтому вставка (и автозаполнение менеджером паролей, это тоже готовый ввод) распознается по характеру перехода значения: рост больше чем на один символ за раз, либо расхождение старого и нового в обе стороны при изменении длины (замена целиком, вставка в середину). Посимвольный ввод, удаление (включая зажатый backspace — предыдущее значение остается префиксом) и замена одного символа той же длины считаются вводом. Ложное «вставка» безвредно: запрос просто уйдет без задержки, дедупликация и кеш сторов поглотят повтор. Утилита живет в `shared/lib/input` — это общий механизм ввода, не логика детекта.

#### 5.2. Мгновенный детект при вставке ключа

**Файл:** `src/shared/lib/ai/provider-detect/hooks/use-provider-detect.ts`

```ts
// src/shared/lib/ai/provider-detect/hooks/use-provider-detect.ts
const previousValueRef = useRef('');

useEffect(() => {
  if (trimmed === '') {
    previousValueRef.current = '';
    return;
  }

  const pasted = isPasteLikeInsertion(previousValueRef.current, trimmed);
  previousValueRef.current = trimmed;

  if (pasted) {
    void useProviderDetectStore.getState().ensureDetect(trimmed);
    return; // мгновенная ветка: таймер ниже не создается
  }

  const timer = setTimeout(() => {
    void useProviderDetectStore.getState().ensureDetect(trimmed);
  }, PROVIDER_DETECT_DEBOUNCE_MS);

  return () => clearTimeout(timer);
}, [trimmed]);
```

**Логика:** ветки взаимоисключающие: `return` после мгновенного вызова завершает эффект, таймер не создается — дублирования вызова нет. Ref хранит предыдущее значение, переход оценивается один раз на каждое изменение — «одноразовость» флага по построению, пробрасывать флаг вставки из формы не нужно. Сигнатура хука не изменилась.

#### 5.3. Мгновенный probe при вставке

**Файл:** `src/shared/lib/ai/provider-detect/hooks/use-base-url-validation.ts`

```ts
// src/shared/lib/ai/provider-detect/hooks/use-base-url-validation.ts
const previousProbeKeyRef = useRef('');

useEffect(() => {
  // Ref обновляется во всех ветках: доверенные/пустые состояния
  // не «помнят» вставку
  const pasted = isPasteLikeInsertion(previousProbeKeyRef.current, probeKey);
  previousProbeKeyRef.current = probeKey;

  if (trusted) return;
  if (trimmedBaseUrl === '' || apiKey.trim() === '') return;

  const runProbe = () => { /* каскад GET /models → POST /chat/completions */ };

  if (pasted) {
    runProbe();
    return () => probeControllerRef.current?.abort();
  }

  const timer = setTimeout(runProbe, PROVIDER_DETECT_DEBOUNCE_MS);
  return () => {
    clearTimeout(timer);
    probeControllerRef.current?.abort();
  };
}, [trusted, trimmedBaseUrl, apiKey, probeKey, detect.provider?.id]);
```

**Логика:** probe ключуется парой «baseUrl|ключ», поэтому эвристика применяется к `probeKey`: вставка любого из слагаемых (ключ при отредактированном baseUrl, сам baseUrl) запускает probe сразу, посимвольный ввод baseUrl — через debounce. Ref обновляется во всех ветках, включая trusted и пустые, чтобы следующий реальный переход оценивался от актуального значения. Аборт in-flight при смене входов и размонтировании сохранен в обеих ветках.

---

## Часть 6: структура — подпапки по ответственности

### Проблема(ы)

**Проблема 1:** в `models-fetcher` фетчеры, стор и парсеры лежали в одной папке — файлы `models-fetcher.ts` и `models-store.ts` рядом не отражали разницу слоев (сеть vs кеш).

**Проблема 2:** в `provider-detect` в одной папке лежали чистая логика детекта, стор, два хука и эвристика вставки — переплетение разнородной логики в одной плоскости.

### Решения

#### 6.1. Итоговая структура

```
src/shared/lib/
  input/                        — общие механизмы ввода
    index.ts
    paste-detection.ts
  ai/
    models-fetcher/
      index.ts                  — бочка (публичный API не изменился)
      fetchers/                 — сеть: fetchAvailableModels, нативные
        models-fetcher.ts         фетчеры, probeChatCompletions
        models-fetcher.config.ts
        models-fetcher.types.ts
      store/                    — кеш списков моделей
        models-store.ts
        models-store.types.ts
      parsers/                  — парсеры ответов провайдеров
        parse-anthropic-models.ts
        parse-cohere-models.ts
        parse-gemini-models.ts
        parse-openai-models.ts
    provider-detect/
      index.ts                  — бочка (публичный API не изменился)
      detect/                   — чистая логика: matchProviders, resolveProvider
        provider-detect.ts
        provider-detect.types.ts
        provider-detect.config.ts
      store/                    — стор результатов детекта
        provider-detect-store.ts
        provider-detect-store.types.ts
      hooks/                    — React-хуки формы
        use-provider-detect.ts
        use-provider-detect.types.ts
        use-base-url-validation.ts
        use-base-url-validation.types.ts
```

**Логика:** все потребители импортируют через бочки `@/shared/lib/ai/models-fetcher` и `@/shared/lib/ai/provider-detect` — их публичный API не изменился, снаружи не поменялось ничего. Внутри папок обновлены только относительные пути; `paste-detection` переехал в `shared/lib/input` как общий механизм ввода. Тесты обновили глубокие импорты (`detect/provider-detect`, `fetchers/models-fetcher.types`).

---

## Итоги

### Изменённые файлы (23 шт)

**models-fetcher:**
1. `src/shared/lib/ai/models-fetcher/index.ts` — бочка: пути на подпапки
2. `src/shared/lib/ai/models-fetcher/fetchers/models-fetcher.ts` — добавлен `probeChatCompletions`; перенесен в `fetchers/`
3. `src/shared/lib/ai/models-fetcher/fetchers/models-fetcher.config.ts` — `CHAT_COMPLETIONS_PATH`, `CHAT_COMPLETIONS_PROBE_BODY`; удален `MODELS_FETCH_DEBOUNCE_MS`
4. `src/shared/lib/ai/models-fetcher/fetchers/models-fetcher.types.ts` — тип `ProbeChatCompletionsResult`
5. `src/shared/lib/ai/models-fetcher/store/models-store.ts` — действие `receiveModels`; перенесен в `store/`
6. `src/shared/lib/ai/models-fetcher/store/models-store.types.ts` — тип действия `receiveModels`
7. `src/shared/lib/ai/models-fetcher/parsers/parse-anthropic-models.ts` — путь импорта типов
8. `src/shared/lib/ai/models-fetcher/parsers/parse-openai-models.ts` — путь импорта типов

**provider-detect:**
9. `src/shared/lib/ai/provider-detect/index.ts` — бочка: пути на подпапки, экспорт paste-утилиты убран
10. `src/shared/lib/ai/provider-detect/detect/provider-detect.ts` — резолвер фетчеров; models победителя в результате
11. `src/shared/lib/ai/provider-detect/detect/provider-detect.types.ts` — `models: string[]` в варианте `resolved`
12. `src/shared/lib/ai/provider-detect/detect/provider-detect.config.ts` — без изменений по содержанию
13. `src/shared/lib/ai/provider-detect/store/provider-detect-store.ts` — запись моделей в models-store после гвардии
14. `src/shared/lib/ai/provider-detect/store/provider-detect-store.types.ts` — путь импорта результата
15. `src/shared/lib/ai/provider-detect/hooks/use-provider-detect.ts` — мгновенный детект при вставке
16. `src/shared/lib/ai/provider-detect/hooks/use-provider-detect.types.ts` — путь импорта статуса
17. `src/shared/lib/ai/provider-detect/hooks/use-base-url-validation.ts` — единый механизм «доверие / probe», каскад, мгновенный probe при вставке
18. `src/shared/lib/ai/provider-detect/hooks/use-base-url-validation.types.ts` — `mode`/`manualBaseUrl` убраны, добавлен `modelsAvailable`

**shared/lib/input:**
19. `src/shared/lib/input/paste-detection.ts` — новый: эвристика `isPasteLikeInsertion`
20. `src/shared/lib/input/index.ts` — новый: бочка

**форма:**
21. `src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts` — единое `baseUrl`, префилл через ref, сверка модели, запрос моделей без debounce
22. `src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx` — providerLabel удален, поле baseUrl всегда видно без анимаций

**тесты:**
23. `tests/api-templates/provider-detect.test.ts` — обновлен под резолвер и новые пути

### Результаты

- ✅ Endpoint без `GET /models`, но с рабочим `POST /chat/completions`, больше не помечается несовместимым
- ✅ Список моделей запрашивается ровно один раз на пару `baseUrl|ключ`: probe коллизии и ручного baseUrl пишут готовый результат в models-store, `ensureModels` его подхватывает
- ✅ Probe коллизии идет нативным фетчером каждого кандидата (anthropic/gemini/cohere — корректный auth), а не дефолтным OpenAI-запросом
- ✅ Поле baseUrl всегда видно и редактируемо: авто-значение подставляется, пока поле не тронуто; правка юзера уходит в probe, UI не прыгает
- ✅ Выбранная модель сверяется со списком текущей пары и очищается, если в нем её нет
- ✅ Модели грузятся сразу после resolved — второй debounce перед запросом удален
- ✅ Вставка/автозаполнение ключа и baseUrl идут без debounce — минус ~1 с до resolved и списка моделей; ручной ввод по-прежнему фильтруется
- ✅ Публичный API бочек не изменился — реструктуризация не затронула ни одного потребителя

---

## Принципы, использованные при рефакторинге

- **Один источник правды** — единственный кэш списков моделей это models-store; в entry детекта models не дублируются.
- **Статус существует, только если на нем ветвится логика** — промежуточные статусы не вводились, ключение вердикта парой входов делает idle автоматическим.
- **Переиспользование вместо нового** — таймаут, паттерн AbortController, debounce и гвардия устаревшего ответа взяты из существующего кода; новое писалось только там, где пусто (probe, receiveModels, trusted-ветка, эвристика вставки).
- **Слои не смешиваются** — типы в `*.types.ts`, константы в `*.config.ts`, логика в чистых модулях, наружу — через бочки `index.ts`; внутри папки — подпапки по ответственности (сеть / кеш / парсеры / хуки).
- **Surgical Changes** — ModelSelect, схема, парсеры и `handleAdd` не переписывались: изменились только точки, затронутые новым потоком данных.
