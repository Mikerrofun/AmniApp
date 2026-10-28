# План: Автоопределение провайдера и baseUrl по префиксу API-ключа

> План для агента-исполнителя. Ветка: `PlaningBaseUrlFetch` (от `main`).
> Все архитектурные решения ниже зафиксированы и обсуждены с автором.
> Менять их по ходу нельзя — сомнение превращается в вопрос, а не в
> импровизацию. Код в плане не приводится: задачи описывают поток данных
> и ссылки на файлы-образцы.

---

## Зафиксированные решения (менять нельзя)

1. **Переключатель провайдера удаляется.** Провайдер и baseUrl определяются
   автоматически по префиксу вставленного API-ключа.
2. **Реестр провайдеров** `PROVIDER_REGISTRY` заменяет `API_TEMPLATE_PRESETS`:
   у каждого провайдера `id`, `label`, `baseUrl`, `prefixes[]`.
3. **Эмуляции (compat-эндпоинты) включены.** Anthropic и Cohere поддерживаются
   через их официальные OpenAI-совместимые слои — это те же baseUrl, говорящие
   на OpenAI-протоколе, поэтому вписываются в общий паттерн без нативных
   адаптеров. Урезанный функционал compat-слоев (нет prompt caching, audio,
   strict function calling у Anthropic) для чат-клиента не критичен.
   Статус «провайдер не поддерживается» из ранних обсуждений исчезает —
   все распознанные префиксы поддерживаются.
4. **Колонка `provider` в БД остаётся и расширяется** (не удаляется): в ней
   хранится id распознанного провайдера (`'openai' | 'openrouter' | ... |
   'custom'`). Старые значения `'openai'`/`'openrouter'` остаются валидными,
   колонка в SQLite — TEXT без ограничений, поэтому **миграция БД не нужна**,
   `DB_SCHEMA_VERSION` остаётся 4. Расширяется только zod-схема и TS-типы.
   Provider нужен для выбора фетчера моделей (п.7) и лейбла в списке.
5. **Коллизия префиксов** (`sk-` у OpenAI и DeepSeek) разрешается
   **параллельным** probe-запросом `GET {baseUrl}/models` — побеждает первый
   успешный. Отправка ключа нескольким серверам параллельно — принятое
   решение (privacy-трейд-офф осознан).
6. **Неизвестный префикс → ручной ввод baseUrl + обязательный probe.**
   Если эндпоинт не отвечает в OpenAI-формате — ошибка валидации + toast,
   сабмит заблокирован. Любой созданный шаблон гарантированно проверен на
   OpenAI-совместимость.
7. **Получение моделей — реестр фетчеров** `MODELS_FETCHERS` по provider:
   известные провайдеры с не-OpenAI списком моделей получают нативный запрос
   + свой парсер; для всех остальных — дефолтный OpenAI-запрос. Fallback
   ручного ввода модели уже существует в `ModelSelect` (TextInput, когда
   список не загрузился) — его не строим, на него опираемся.
8. **Ключ кэша моделей меняется на `baseUrl|apiKey`** (сейчас `provider|apiKey`):
   два шаблона с одинаковыми baseUrl+ключ шарят один запрос списка моделей.
9. **Чат и стриминг не меняются**: `openai-compat-client` читает
   `template.baseUrl` из строки — контракт не меняется.
10. **Документацию не писать и не просить** — она делается после полного
    рефакторинга отдельным шагом.

---

## 0. Файлы для изучения (обязательно перед началом)

Читать в этом порядке — они дают картину проекта и именно этого места:

1. `docs/VISION.md` — концепция (Privacy First / BYOK, нативный fetch без
   бекенда), стек, этапы.
2. `docs/features/api-templates-streaming-chat.md` — реализованная фича
   страницы API: эталон паттернов (форма, стор, SSE-клиент, i18n).
3. `docs/plans/model-selection-feature.md` — предыдущий план этой же формы:
   источник паттернов (debounce, кэш стора, ModelSelect), на которые мы
   опираемся и которые частично меняем.
4. `src/app/(tabs)/api/components/TemplateForm/TemplateForm.tsx` и
   `useTemplateForm.ts` — точка интеграции: здесь живет переключатель
   провайдера, который удаляется; здесь же образец паттерна «ошибка + toast»
   (`showToast` из `@/shared/components/ui/Toast`: `invalidForm`,
   `duplicateName`, `saveFailed`).
5. `src/shared/config/config.types.ts` — текущие `API_TEMPLATE_PRESETS`
   (2 пресета); на их месте появляется реестр провайдеров с префиксами.
6. `src/shared/lib/ai/models.ts`, `models.types.ts`, `models-store.ts`,
   `models-store.types.ts`, `models.config.ts`, `normalize-models.ts` —
   команда `fetchAvailableModels` (переиспользуем как probe и как дефолтный
   фетчер) и стор-кэш моделей (меняем ключ кэша на `baseUrl|apiKey`).
7. `src/shared/components/ModelSelect/ModelSelect.tsx`, `useModelSelect.ts`,
   `ModelSelect.types.ts` — пропс `provider` удаляется; встроенный fallback
   ручного ввода модели (ветка `!hasList` → TextInput) — на него опираемся.
8. `src/schemas/api-template.ts` — схема формы: расширяется enum провайдеров,
   добавляется опциональный `baseUrl` с superRefine-правилом.
9. `src/types/api-template.ts` — типы шаблона: `provider` расширяется,
   реэкспорты из shared/config обновляются.
10. `src/lib/db/migrations.ts` + `src/lib/db/db.config.ts` — убедиться, что
    колонка `provider` TEXT без ограничений (миграция не нужна, версия 4).
11. `src/lib/db/templates-repository.ts` — `createTemplate` начинает
    принимать `baseUrl` параметром (сейчас вычисляется из пресета).
12. `src/features/api-templates/model/templates-store.ts` +
    `templates-store.types.ts` — сигнатура `addTemplate`.
13. `src/app/(tabs)/api/components/TemplateList/TemplateList.tsx` — сабтайтл
    `provider · model`: provider берется из реестра по id.
14. `src/shared/i18n/messages/en.json` / `ru.json` — секции `apiTab`,
    `modelSelect`.
15. `tests/api-templates/api-template-validation.test.ts` — тесты схемы,
    обновляются в конце (задача 10).

---

## 1. Как работает сейчас (контекст)

- В форме шаблона переключатель из 2 пресетов (`openai` / `openrouter`);
  `baseUrl` вычисляется как `API_TEMPLATE_PRESETS[provider].baseUrl` —
  в форме, в репозитории и в чат-флоу независимо.
- После остановки ввода ключа (debounce 1000ms) `ensureModels(provider,
  baseUrl, apiKey)` запрашивает `GET {baseUrl}/models`; кэш в
  `models-store` ключуется `provider|apiKey`.
- `createTemplate` в репозитории сам вычисляет baseUrl из пресета — форма
  baseUrl не передает.
- Сабтайтл шаблона в списке: `{template.provider} · {template.model}`.

## 2. Что делаем (сводка)

1. **Реестр провайдеров** (`src/shared/config/`): `PROVIDER_REGISTRY` —
   массив записей `ApiProviderConfig { id, label, baseUrl, prefixes[] }`.
   Состав (префиксы и baseUrl сверить с документацией провайдеров перед
   коммитом — таблица основана на общеизвестных значениях):

   | id | prefix(es) | baseUrl | примечание |
   |---|---|---|---|
   | openai | `sk-proj-`, `sk-` | `https://api.openai.com/v1` | коллизия с deepseek |
   | openrouter | `sk-or-v1-`, `sk-or-` | `https://openrouter.ai/api/v1` | длинный префикс, однозначный |
   | deepseek | `sk-` | `https://api.deepseek.com/v1` | коллизия с openai |
   | groq | `gsk_` | `https://api.groq.com/openai/v1` | |
   | perplexity | `pplx-` | `https://api.perplexity.ai` | |
   | huggingface | `hf_` | `https://router.huggingface.co/v1` | |
   | gemini | `AIza` | `https://generativelanguage.googleapis.com/v1beta/openai` | compat-эмуляция |
   | anthropic | `sk-ant-` | `https://api.anthropic.com/v1` | compat-эмуляция (GA) |
   | cohere | `csk-` | `https://api.cohere.ai/compatibility/v1` | compat-эмуляция |
   | custom | — (без префиксов) | — (вводит юзер) | ручной режим |

   Провайдеры без стабильного префикса (Mistral, Together) в реестр не
   входят — их ключи попадают в ветку «неизвестный префикс» с ручным вводом
   baseUrl. baseUrl в реестре хранится без завершающего слеша (запросы
   строятся конкатенацией `{baseUrl}/models`).
2. **Детектор** (`src/shared/lib/ai/provider-detect.*`): чистый
   longest-prefix match + разрешение коллизий параллельным probe.
3. **Стор детекта + хук** (`provider-detect-store.ts`, `useProviderDetect`):
   по образцу `models-store` — кэш на сессию, in-flight дедупликация, abort.
4. **Реестр фетчеров моделей** (`MODELS_FETCHERS`): по provider выбирается
   способ получения списка моделей (п.3.2 потока данных).
5. **Форма**: переключатель → строка состояния детекта; ручной ввод baseUrl
   с обязательным probe; ModelSelect без пропса `provider`.
6. **Данные**: `provider` расширяется (не удаляется), `createTemplate` /
   `addTemplate` принимают `baseUrl` параметром, миграции БД нет.
7. **i18n**: новые ключи состояний детекта и ручного baseUrl.

## 3. Поток данных (подробно)

### 3.1 Детект провайдера

1. Юзер вставляет ключ в поле `apiKey`. `setApiKey` (как сейчас) сбрасывает
   `model` и отменяет in-flight запрос моделей; дополнительно — очищает
   ручной `baseUrl`, если он был (новый ключ — новая попытка детекта).
2. Хук `useProviderDetect(apiKey)` после debounce (константа из конфига
   детекта) вызывает `ensureDetect(apiKey)` стора детекта.
3. `ensureDetect` → `matchProviders(apiKey)`: сопоставление префиксов из
   реестра, самый длинный префикс выигрывает (`sk-or-v1-` бьется раньше
   `sk-`, `sk-ant-` раньше `sk-`), регистр не важен. Результат — список
   кандидатов: 0, 1 или несколько id.
4. Три исхода:
   - **1 кандидат** → `resolved(providerId, baseUrl)` сразу, без запроса.
   - **Несколько** (коллизия `sk-`) → параллельный probe: для каждого
     кандидата `fetchAvailableModels({ baseUrl, apiKey, signal })` —
     переиспользование существующей команды, она уже классифицирует
     401/403/сеть/таймаут. Первый успешный ответ побеждает; все неуспешны →
     `failed`.
   - **0 кандидатов** → `unknown`.
5. Запись кэшируется в сторе по `apiKey` на сессию: повторная вставка того
   же ключа — из кэша, запроса нет. Смена ключа абортит старый probe; ответ
   от старого ключа не перезаписывает состояние новой записи (паттерн
   `inFlightControllers` из `models-store`).

### 3.2 Загрузка моделей

1. `ModelSelect` получает `baseUrl` (из детекта или ручного ввода) и
   `apiKey`; пропса `provider` у него больше нет.
2. `ensureModels(provider, baseUrl, apiKey)` в `models-store`: ключ кэша —
   `modelsCacheKey(baseUrl, apiKey)`; параметр `provider` остается в
   сигнатуре — по нему выбирается фетчер.
3. Выбор фетчера из `MODELS_FETCHERS` по provider id:
   - **дефолт** (openai, openrouter, deepseek, groq, perplexity,
     huggingface, custom): существующий `fetchAvailableModels` —
     `GET {baseUrl}/models`, `Authorization: Bearer`, нормализация через
     `normalizeModelList`.
   - **anthropic**: нативный `GET https://api.anthropic.com/v1/models` с
     `x-api-key` + `anthropic-version` заголовками; парсер маппит
     Anthropic-формат (`data[].id`) в тот же нормализованный список.
     Нативный эндпоинт используем намеренно — не полагаемся на то, что
     compat-слой отдаёт `/models` в OpenAI-формате.
   - **gemini**: нативный `GET .../v1beta/models?key=<apiKey>`; парсер маппит
     Gemini-формат (`models[].name`, срезая префикс `models/`) в
     нормализованный список.
   - **cohere**: нативный `GET https://api.cohere.ai/v1/models` (Bearer);
     парсер маппит `models[].name`. (Сверить с документацией при реализации;
     если compat-эндпоинт отдает OpenAI `/models` — можно оставить дефолт.)
   Каждый фетчер — маленькая функция «запрос + парсер», ошибки
   классифицируются в тот же `FetchModelsResult`, что и дефолт.
4. Если список не загрузился (`error`/`idle`) — `ModelSelect` уже показывает
   TextInput ручного ввода модели (существующая ветка `!hasList`). Это и
   есть согласованный fallback «/models не ответил → ручной ввод модели»,
   отдельная работа не нужна.
5. Кэш шарится: два шаблона/попытки с одинаковыми `baseUrl|apiKey` (например,
   два ключа OpenRouter) дают один запрос списка на сессию.

### 3.3 Ручной ввод baseUrl (unknown / failed)

1. Детект вернул `unknown` (префикс не распознан) или `failed` (коллизия,
   но все probe неуспешны) → в форме на месте переключателя появляется поле
   `baseUrl` (тот же паттерн TextInput, что остальные поля; при `failed` —
   подсказка `apiTab.detectFailed`).
2. Юзер вводит baseUrl. После debounce (конфиг детекта) запускается
   **обязательный probe**: `fetchAvailableModels({ baseUrl, apiKey })` —
   та же механика, что и в коллизии.
3. Probe успешен → baseUrl валиден, список моделей загружается через
   дефолтный фетчер, `provider` для сохранения = `'custom'`.
4. Probe неуспешен (401/403/сеть/не-OpenAI-формат ответа) → ошибка валидации
   на поле + **toast** `apiTab.baseUrlNotCompatible` («эндпоинт не отвечает
   в OpenAI-совместимом формате»), сабмит заблокирован. Паттерн «ошибка +
   toast» уже существует в `useTemplateForm` (`showToast` +
   `apiTab.invalidForm` / `duplicateName` / `saveFailed`) — переиспользовать
   его, не изобретать новый.
5. По-настоящему несовместимые серверы (голый Anthropic-эндпоинт за прокси)
   отсекаются probe-ом честно: они не работали и раньше, регрессии нет.

### 3.4 Сабмит и сохранение

1. `canSubmit` = name + model + apiKey + (детект `resolved` ИЛИ ручной
   baseUrl, прошедший probe).
2. `handleAdd` валидирует форму схемой (см. задачу 6) и вызывает
   `addTemplate(name, providerId, resolvedBaseUrl, model, apiKey)`, где
   `providerId` — id из детекта или `'custom'`, `resolvedBaseUrl` — из
   детекта или из поля ручного ввода.
3. `createTemplate` больше не вычисляет baseUrl из пресета — пишет
   переданный `baseUrl` и `provider` в строку. Ключ по-прежнему уходит в
   SecureStore под `template-key-<id>`, в БД только `key_ref`.
4. После успеха — существующая анимация очистки формы (тайминги
   `API_TAB_ANIMATION` не менять).

### 3.5 Чат (без изменений)

Чат-флоу и `openai-compat-client` читают `template.baseUrl` и ключ из
SecureStore в момент отправки. Фича меняет только то, **откуда** берутся
`provider` и `baseUrl` в момент создания шаблона; контракт потребления
шаблона не меняется. Проверить grep-ом потребителей `template.provider`
(сабтайтл списка, чат-флоу) и свести на новые типы.

## 4. Задачи

### Задача 1. Реестр провайдеров

`src/shared/config/`: заменить `API_TEMPLATE_PRESETS` на `PROVIDER_REGISTRY`
(тип `ApiProviderConfig { id, label, baseUrl, prefixes }` — в файл типов,
реестр — в конфиг-файл, см. принципы FSD). Юнион `ApiTemplateProvider`
расширить до всех id реестра + `'custom'`. Сверить префиксы и baseUrl с
документацией провайдеров. Обновить реэкспорты в `src/types/api-template.ts`,
grep-ом найти всех импортирующих `API_TEMPLATE_PRESETS` / `ApiTemplatePreset`
и свести на новые имена.

Ссылки: `src/shared/config/config.types.ts`, `src/types/api-template.ts`.

### Задача 2. Детектор: типы, конфиг, логика

`src/shared/lib/ai/provider-detect.types.ts` — дискриминированный union
результата: `resolved(providerId, baseUrl)` | `unknown` | `failed`
(статусы стора — там же или в types стора).
`provider-detect.config.ts` — debounce детекта, таймаут probe
(переиспользовать `MODELS_REQUEST_TIMEOUT_MS`), минимальная длина ключа
(согласована с `models.config` — 20).
`provider-detect.ts` — `matchProviders` (чистая функция, longest-prefix,
возвращает кандидатов по убыванию длины префикса) и `resolveProvider`
(1 кандидат → resolved без запроса; несколько → параллельный probe через
`fetchAvailableModels`, первый `ok` побеждает; все неуспешны → `failed`).
Логика — только здесь, импорты только из `shared`/`lib`, никаких
`features/` и `app/`.

Ссылки: `src/shared/lib/ai/models.ts`, `models.config.ts`.

### Задача 3. Стор детекта + хук

`provider-detect-store.ts` + `provider-detect-store.types.ts` по образцу
`models-store.ts`: Map записей по `apiKey`, статусы
`idle | detecting | resolved | unknown | failed`, `ensureDetect(apiKey,
signal?)` с in-flight дедупликацией и abort при смене ключа, кэш на сессию.
Хук `useProviderDetect(apiKey)` рядом: debounce из конфига, запуск
`ensureDetect`, отмена при очистке ключа; возвращает `{ status, provider?,
baseUrl? }` (provider — конфиг из реестра, для лейбла).

Ссылки: `src/shared/lib/ai/models-store.ts`, `models-store.types.ts`,
`src/features/api-templates/model/templates-store.ts` (паттерн стора).

### Задача 4. Реестр фетчеров моделей + ключ кэша `baseUrl|apiKey`

`src/shared/lib/ai/`: реестр `MODELS_FETCHERS` (по provider id → функция
«запрос + парсер», возвращающая `FetchModelsResult`) — в конфиг-файле,
типы фетчера — в `models.types.ts`. Дефолт — существующий
`fetchAvailableModels`; отдельные фетчеры anthropic / gemini / cohere —
нативный запрос + парсер в нормализованный список (парсеры — рядом с
`normalize-models.ts`, чтобы тестировались без expo/fetch).
В `models-store.ts` / `models-store.types.ts` / `useModelSelect.ts` /
`ModelSelect.types.ts` / `ModelSelect.tsx`: `modelsCacheKey(baseUrl,
apiKey)`, пропс `provider` у `ModelSelect` удаляется (baseUrl уже есть).
Grep-ом проверить всех вызывателей `ensureModels` / `cancelKey` /
`modelsCacheKey` и свести на новые сигнатуры.

Ссылки: `src/shared/lib/ai/models*.ts`, `normalize-models.ts`,
`src/shared/components/ModelSelect/*`.

### Задача 5. Форма: удаление переключателя, интеграция детекта

`useTemplateForm.ts` / `TemplateForm.tsx`:

- удалить состояние `provider`/`setProvider` и блок-переключатель
  (вместе с `apiTab.provider` из i18n);
- подключить `useProviderDetect(apiKey)`; состояние детекта рендерится на
  месте переключателя: `detecting` — ненавязчивый плейсхолдер, `resolved` —
  лейбл провайдера из реестра, `unknown`/`failed` — поле `baseUrl`
  (паттерн существующих TextInput полей; при `failed` — подсказка
  `apiTab.detectFailed`);
- ручной baseUrl: debounce → probe через `fetchAvailableModels`; успех —
  ModelSelect активен, провал — ошибка на поле + toast
  `apiTab.baseUrlNotCompatible` (паттерн `showToast` из `useTemplateForm`);
- `ModelSelect` получает `baseUrl` из детекта или ручного ввода; при
  unknown/failed и пустом/непроверенном baseUrl — заблокирован;
- смена ключа сбрасывает `model` (уже есть) и очищает ручной baseUrl;
- `canSubmit`: name + model + apiKey + (resolved ИЛИ probe-passed baseUrl);
- `handleAdd` вызывает `addTemplate(name, providerId, resolvedBaseUrl,
  model, apiKey)`.

Ссылки: `TemplateForm.tsx`, `useTemplateForm.ts`, `api-tab.animation.ts`
(тайминги не менять).

### Задача 6. Схема формы

`src/schemas/api-template.ts`: расширить `apiTemplateProviderSchema` до всех
id реестра + `'custom'`; добавить опциональное `baseUrl:
z.string().trim().url()` (или пустая строка) с `superRefine`: если форма в
режиме ручного ввода (детект не resolved) и `baseUrl` пустой/невалидный —
ошибка на поле `baseUrl`. Форма передает в схему флаг «baseUrl обязателен»,
чтобы правило не срабатывало при resolved-детекте.

Ссылки: `src/schemas/api-template.ts`, `useTemplateForm.ts`.

### Задача 7. Данные: репозиторий, стор, список

- `src/lib/db/templates-repository.ts`: `createTemplate(name, provider,
  baseUrl, model, apiKey)` — baseUrl приходит параметром, вычисление из
  пресета удаляется; `mapTemplateRow` маппит `provider` в расширенный тип.
- `src/features/api-templates/model/templates-store.ts` +
  `templates-store.types.ts`: `addTemplate(name, provider, baseUrl, model,
  apiKey)`.
- `src/types/api-template.ts`: `ApiTemplate.provider` — расширенный юнион.
- `TemplateList.tsx`: сабтайтл — лейбл провайдера из реестра по id
  (неизвестный id → сам id) `· model`.
- **Миграции БД нет**: колонка `provider` TEXT без ограничений, старые
  значения валидны, `DB_SCHEMA_VERSION` остается 4. Убедиться чтением
  `migrations.ts` и оставить комментарий-обоснование, почему миграция не
  нужна (расширение enum — уровень типов, не схемы).
- Grep-ом проверить потребителей `template.provider` (чат-флоу, FastCheck)
  и свести на расширенный тип.

Ссылки: `templates-repository.ts`, `templates-store.ts`,
`templates-store.types.ts`, `TemplateList.tsx`, `migrations.ts`,
`db.config.ts`.

### Задача 8. i18n

`en.json` / `ru.json`, секция `apiTab`: удалить `provider`; добавить
`detecting`, `detectFailed`, `baseUrl`, `baseUrlPlaceholder`,
`baseUrlNotCompatible`. Тексты короткие, ru/en пары симметричны.

Ссылки: `src/shared/i18n/messages/en.json`, `ru.json`.

### Задача 9. Минимальные тесты (в конце, агента не перегружать)

- `matchProviders`: уникальный префикс → один кандидат; `sk-or-v1-` →
  только OpenRouter (longest-prefix); `sk-` → [openai, deepseek]
  (коллизия); `sk-ant-` → anthropic; неизвестный ключ → пусто.
- `resolveProvider`: один кандидат — resolved без запроса; коллизия —
  первый успешный probe побеждает (fetch замокать); все неуспешны —
  `failed`.
- Схема: ручной режим без baseUrl — ошибка на `baseUrl`; с валидным —
  проходит; обновить существующий тест под расширенный enum.

Расположение — по существующему паттерну (`tests/`, node:test + assert).

## 5. Принципы для исполнителя (обязательно)

- **FSD / типизация**: все типы — в отдельных файлах типов (`*.types.ts` /
  `src/types/`), все константы-конфиги — в отдельных конфиг-файлах
  (`*.config.ts`). В файлах логики и компонентов типов и магических
  констант не оставлять.
- **Переиспользуемость**: детектор, стор детекта, хук и реестр фетчеров не
  импортируют ничего из `features/` и `app/` — только `shared` и `lib`.
  Probe — переиспользование `fetchAvailableModels`, не копия. Паттерны
  (стор, debounce, abort, toast, i18n) — переиспользовать, не копировать.
- **Приватность**: ключ не логируется, уходит только в заголовках
  (`Authorization: Bearer` / `x-api-key` / query `?key=` для Gemini) на
  baseUrl провайдеров. Параллельный probe отправляет ключ нескольким
  серверам — решение принято осознанно.
- **Комментарии**: только на действительно неочевидных местах (why, а не
  what): обоснование параллельного probe, причина нативных фетчеров для
  anthropic/gemini, отсутствие миграции БД. В остальных местах — чистый код.
- **Тесты — в конце, минимальные** (задача 9).
- **Документацию не писать и не просить.**
