# План: единая валидация baseUrl + models из probe + всегда видимое поле

**Ветка:** `refactoringAutoDetectBaseUrl`
**Дата:** 16.11.2026
**Статус:** согласован с заказчиком, ожидает одобрения на реализацию

---

## 0. Файлы для изучения перед работой (читать в этом порядке)

1. `docs/features/provider-detect-and-base-url.md` — как система устроена сейчас и почему.
2. `src/shared/config/providers.config.ts` + `src/shared/config/config.types.ts` — реестр провайдеров, источник id/prefixes/baseUrl.
3. `src/shared/lib/ai/provider-detect/` — вся папка: `provider-detect.ts`, `provider-detect-store.ts` + `.types.ts`, `use-provider-detect.ts` + `.types.ts`, `use-base-url-validation.ts` + `.types.ts`, `provider-detect.config.ts`, `index.ts`.
4. `src/shared/lib/ai/models-fetcher/` — вся папка: `models-fetcher.ts`, `models-fetcher.config.ts`, `models-fetcher.types.ts`, `models-store.ts` + `.types.ts`, `parsers/`, `index.ts`.
5. `src/app/(tabs)/api/components/TemplateForm/useTemplateForm.ts` + `TemplateForm.tsx` — точка сборки, куда все встраивается.
6. `src/shared/components/ModelSelect/` — `ModelSelect.tsx`, `useModelSelect.ts`, `ModelSelect.types.ts`: ручной ввод модели при пустом списке уже реализован веткой `!hasList → TextInput`.
7. `src/schemas/api-template.ts`, `src/types/api-template.ts` — схема формы и типы шаблона.

## Общие правила для всех задач

- Вся типизация — в `*.types.ts` рядом с модулем, константы/тайминги/URL — в `*.config.ts`. Логика, типы и конфиг не смешиваются в одном файле (FSD: `shared/lib/ai/...`, `shared/components/...`, форма — слой `app`).
- Комментарии — только на неочевидных с первого взгляда местах (гонки, дедуп, почему статус ключуется парой входов). Не комментировать очевидное.
- Документацию не писать (обновление заметки — после полного рефакторинга).
- Наружу модули отдаются через бочки `index.ts`; тесты могут брать глубокие пути.

## Поток данных после рефакторинга (эталон)

```
Авто, поле не тронуто:
  ключ → debounce → ensureDetect → resolveProvider
    → 1 кандидат → resolved по префиксу (без запроса)
    → коллизия → параллельный probe нативными фетчерами → победитель + его models
  → baseUrl из реестра автоматически в поле (если поле не тронуто юзером)
  → ensureModels (1 запрос) → models-store ready → ModelSelect

Поле изменено юзером ИЛИ префикс не распознан:
  debounce → probe GET /models фетчером по provider id
    ok   → models пишутся в models-store → ok, modelsAvailable = true
    fail → fallback POST /chat/completions
             200 OK → ok, modelsAvailable = false → ModelSelect: ручной ввод
             не 200 → fail

Список моделей готов → сверка выбранной модели: нет в списке → очистка
Смена ключа → сброс модели, cancelKey пары, очистка поля baseUrl
```

## Принятые решения (контекст для агента)

- `resolved` для single-кандидата ставится по префиксу без запроса — модели все равно
  приходят одним запросом через `ensureModels`; дублирование чинится только там, где
  probe уже выполняется (коллизия, ручной/измененный baseUrl).
- Fallback-проверка совместимости endpoint без `GET /models` — `POST /chat/completions`,
  успех = строго HTTP 200 OK (тело не валидируется).
- Провайдер определяется ключом и не меняется при правке baseUrl; фетчер выбирается
  по provider id из детекта.
- Поле baseUrl всегда видимо и редактируемо; авто-детект записывает реестровый baseUrl
  в поле, юзер может переписать (прокси, смененный URL, новый провайдер).
- Текст `providerLabel` из формы удаляется.
- Сверка модели: после успешной загрузки списка модель, которой нет в списке, очищается;
  найденная — остается.

---

## Задача 1. models-fetcher: fallback-probe + прием моделей в стор

**Файлы:** `models-fetcher.ts`, `models-fetcher.config.ts`, `models-fetcher.types.ts`, `models-store.ts`, `models-store.types.ts`, `index.ts`.

1. В `models-fetcher.config.ts` добавить константы fallback-проверки: суффикс пути `/chat/completions`, минимальное dummy-тело запроса (role user, короткий content), переиспользовать существующий `MODELS_REQUEST_TIMEOUT_MS`.
2. В `models-fetcher.types.ts` описать тип функции probe: параметры как у `ModelsFetcher` (baseUrl, apiKey, signal), результат — `{ ok: true } | { ok: false, reason }` (переиспользовать `FetchModelsErrorReason`).
3. В `models-fetcher.ts` реализовать `probeChatCompletions`: POST `{baseUrl}/chat/completions` с `Authorization: Bearer`, логика успеха — строго HTTP 200 (тело не валидируем, по решению юзера). Классификация ошибок повторяет `fetchAvailableModels`: 401/403 → `unauthorized`, прочий не-200 → `other`, отмена/таймаут/сеть — по образцу существующего `fetchProviderJson` (тот же паттерн AbortController + таймаут + внешний signal).
4. В `models-store.ts` добавить действие `receiveModels(baseUrl, apiKey, models)`: пишет в кэш готовую запись `ready` по ключу `modelsCacheKey`. Это точка, куда probe кладет уже полученные модели, чтобы `ensureModels` увидел готовую запись и не дублировал запрос. Тип действия — в `models-store.types.ts`. Экспортировать через бочку `index.ts`.

## Задача 2. provider-detect: коллизия — фетчер по кандидату + models в результате

**Файлы:** `provider-detect.types.ts`, `provider-detect.ts`, `provider-detect-store.ts`.

1. В `provider-detect.types.ts`: вариант `resolved` дополняется полем `models: string[]` (у single-кандидата — пустой массив, у победителя коллизии — список из его probe).
2. В `provider-detect.ts` изменить сигнатуру `resolveProvider`: вместо одного фетчера — резолвер `(providerId: string) => ModelsFetcher`. Логика: single-кандидат → `resolved` без запроса (как решил юзер, замечание снято); коллизия → каждому кандидату параллельный probe его собственным фетчером из резолвера (для anthropic/gemini/cohere — нативный, корректный auth), `firstFulfilled` выбирает победителя, в результат идут `providerId`, `baseUrl` и models победителя. Все rejected → `failed`.
3. В `provider-detect-store.ts`: после успешного `resolveProvider` со статусом resolved и непустым models — записать модели в `models-store` через `receiveModels(baseUrl, apiKey, models)` (импорт из `../models-fetcher`). Гвардия «устаревший ответ не перезаписывает новую запись» уже есть — сохранить ее порядок (проверка контроллера до записи). В самом entry детекта models не хранить — единственный кэш списков это `models-store`.

## Задача 3. useBaseUrlValidation: один механизм «доверие / probe»

**Файлы:** `use-base-url-validation.ts`, `use-base-url-validation.types.ts`.

1. Типы: параметр `mode` убрать. Новые параметры: `apiKey`, `baseUrl` (текущее значение поля формы). Результат дополнить флагом `modelsAvailable: boolean`.
2. Логика по шагам:
   - Хук внутри уже читает `useProviderDetect(apiKey)` — оставить.
   - Вычислить `trusted`: detect.status === 'resolved' И `baseUrl.trim()` совпадает с `detect.baseUrl`. Trusted → вернуть `{ status: 'ok', baseUrl, modelsAvailable: true }` без каких-либо запросов (модели придут через `ensureModels`).
   - Не trusted, но baseUrl непустой и ключ непустой → debounce `PROVIDER_DETECT_DEBOUNCE_MS`, затем probe: фетчер по provider id из детекта (`getModelsFetcher`), при неизвестном провайдере — `fetchAvailableModels`.
     - ok → `receiveModels(baseUrl, apiKey, models)` → состояние `{ status: 'ok', modelsAvailable: true }`.
     - fail → `probeChatCompletions` → 200 → `{ status: 'ok', modelsAvailable: false }`; иначе `{ status: 'fail', modelsAvailable: false }`.
   - Пустой baseUrl или ключ → idle.
3. Ключевание статуса парой «baseUrl|ключ» сохранить как есть (паттерн `probeKey` в текущем файле) — смена любого слагаемого мгновенно дает idle без set-state в теле эффекта. Аборт in-flight при смене входов и размонтировании — по образцу существующих контроллеров.

## Задача 4. useTemplateForm: одно поле baseUrl, префилл, сверка модели

**Файлы:** `useTemplateForm.ts`.

1. Переименовать `manualBaseUrl/setManualBaseUrl` в единый `baseUrl/setBaseUrl` — поле одно и всегда видимо.
2. Префилл: когда detect переходит в resolved и поле «не тронуто юзером» (пустое или равно предыдущему авто-значению — отслеживать ref'ом последнее авто-подставленное значение), записать в поле `detect.baseUrl`. Если юзер уже правил поле — его значение не трогать, оно уйдет в probe.
3. Производные: `isTrusted` = detect resolved и поле совпадает с `detect.baseUrl`; `baseUrlRequired` для фабрики схемы = `!isTrusted`; `providerId` = `detect.provider?.id ?? 'custom'` (не меняется при правке baseUrl — решение юзера).
4. Вызов `useBaseUrlValidation({ apiKey, baseUrl })`; из результата берутся `status` → `baseUrlReady`, `baseUrl` → `resolvedBaseUrl`, `modelsAvailable`.
5. Эффект авто-запроса моделей: условие расширить — срабатывать только при `baseUrlReady && modelsAvailable` (при fallback-only endpoint запросать список бессмысленно). Debounce `MODELS_FETCH_DEBOUNCE_MS` и `ensureModels(providerId, resolvedBaseUrl, apiKey)` — как сейчас.
6. Новый эффект сверки модели: подписка на запись `models-store` по `modelsCacheKey(resolvedBaseUrl, apiKey)`; когда запись стала `ready` и в поле есть модель, которой нет в списке → `setModel('')`. Только очистка, авто-выбор модели не делать. Логика покрывает и смену baseUrl, и смену ключа.
7. `setApiKey`: при реальной смене ключа — сброс модели, `cancelKey` текущей пары, очистка поля baseUrl (новый ключ — новая попытка детекта). `setBaseUrl` — просто запись состояния: probe делает хук; запись моделей за старую пару остается в кэше и безвредна (вернуться к старому baseUrl = мгновенно из кэша).
8. Из возвращаемого объекта убрать `providerLabel`, `isManual`, `manualBaseUrl/setManualBaseUrl`; добавить `baseUrl/setBaseUrl`, `modelsAvailable` (если понадобится рендеру).

## Задача 5. TemplateForm.tsx: UI

**Файлы:** `TemplateForm.tsx`.

1. Удалить блок `providerLabel` (Animated.View с текстом) — текст провайдера в форме больше не нужен.
2. Поле baseUrl: рендерится всегда (убрать условие `isManual` и его Animated-обертку с FadeInUp/FadeOut — появление/исчезание больше не происходит). Label `apiTab.baseUrl`, TextInput со значением `baseUrl` и `setBaseUrl`, стили — как у текущего поля (классы не менять).
3. ModelSelect: пропсы не меняются (`baseUrl`, `apiKey`, `disabled={!baseUrlReady}`) — ручной ввод модели при отсутствии списка уже реализован веткой `!hasList → TextInput` в `ModelSelect.tsx`; при `modelsAvailable: false` список просто не придет и поле ввода модели будет доступно после ok.
4. i18n-ключи не добавлять; проверить, что `apiTab.baseUrl` и `apiTab.baseUrlPlaceholder` существуют в `en.json`/`ru.json`.

## Задача 6. Тесты (в конце, минимально)

1. Обновить `tests/.../provider-detect.test.ts` под новую сигнатуру `resolveProvider` (резолвер фетчеров вместо одного фетчера) и проверить, что победитель коллизии возвращает свои models; single-кандидат — по-прежнему без запроса.
2. Прогнать существующие `api-template-validation.test.ts` и парсеры — сигнатуры схемы и парсеров не меняются, должны пройти как есть.
3. Финальная проверка: `tsc`, линт, тесты. Новых наборов тестов не добавлять.
