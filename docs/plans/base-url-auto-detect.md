# План: Автоопределение baseUrl по префиксу API-ключа (убираем переключатель провайдера)

> План для агента-исполнителя. Ветка: `PlaningBaseUrlFetch` (от `main`).
> Цель: в форме шаблона на вкладке API переключатель провайдера (OpenAI /
> OpenRouter) удаляется. Провайдер и baseUrl определяются автоматически по
> префиксу вставленного API-ключа (конфиг префиксов в shared). Коллизия
> префиксов (например, `sk-` у OpenAI и DeepSeek) разрешается параллельным
> пробным запросом `GET {baseUrl}/models` — побеждает первый успешный.
> Неизвестный префикс → ручной ввод baseUrl (паттерн поля models).
> Колонка `provider` удаляется из БД, схемы, типов и сторов — её потребность
> ушла: baseUrl теперь определяется в момент создания и пишется в строку.

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
   провайдера, который удаляется, и авто-запрос моделей по ключу.
5. `src/shared/config/config.types.ts` — текущие `API_TEMPLATE_PRESETS`
   (2 пресета); на их месте появляется реестр провайдеров с префиксами.
6. `src/shared/lib/ai/models.ts`, `models-store.ts`, `models-store.types.ts`,
   `models.config.ts` — команда `fetchAvailableModels` (переиспользуем как
   probe) и стор-кэш моделей (меняем ключ кэша с `provider|apiKey` на
   `baseUrl|apiKey`).
7. `src/shared/components/ModelSelect/ModelSelect.tsx`,
   `useModelSelect.ts`, `ModelSelect.types.ts` — пропс `provider` удаляется.
8. `src/schemas/api-template.ts` — схема формы: удаляется `provider`,
   добавляется опциональный `baseUrl` с superRefine-правилом.
9. `src/types/api-template.ts` — типы шаблона: удаляется `provider`.
10. `src/lib/db/migrations.ts` + `src/lib/db/db.config.ts` — миграция v5
    (пересоздание `api_templates` без `provider`), версия схемы 4 → 5.
11. `src/lib/db/templates-repository.ts` — `createTemplate` принимает
    `baseUrl` вместо `provider`.
12. `src/features/api-templates/model/templates-store.ts` +
    `templates-store.types.ts` — сигнатура `addTemplate`.
13. `src/app/(tabs)/api/components/TemplateList/TemplateList.tsx` — сабтайтл
    строки шаблона показывает `provider · model`; provider удаляется.
14. `src/shared/i18n/messages/en.json` / `ru.json` — секция `apiTab`.
15. `tests/api-templates/api-template-validation.test.ts` — тесты схемы,
    обновляются под новую форму.

---

## 1. Что делаем (сводка)

1. **Реестр провайдеров вместо пресетов** (`src/shared/config/config.types.ts`):
   `API_TEMPLATE_PRESETS` заменяется на `PROVIDER_REGISTRY` — список
   OpenAI-совместимых провайдеров, у каждого `id`, `label`, `baseUrl` и
   `prefixes[]` (префиксы ключей). В реестр входят только провайдеры со
   стабильными документированными префиксами и OpenAI-совместимым API:
   OpenAI (`sk-`), OpenRouter (`sk-or-v1-`, `sk-or-`), DeepSeek (`sk-`),
   Groq (`gsk_`), Perplexity (`pplx-`), HuggingFace (`hf_`,
   `router.huggingface.co/v1`), Gemini (`AIza`,
   `generativelanguage.googleapis.com/v1beta/openai`). Anthropic (`sk-ant-`)
   и Cohere (`csk-`) — в реестр входят с флагом `supported: false` (протокол
   не OpenAI-совместимый, адаптеры — v2.5): префикс распознается, но шаблон
   создать нельзя, показывается понятное сообщение. Провайдеры без
   стабильного префикса (Mistral, Together) в реестр не входят — их ключи
   попадут в ветку «неизвестный префикс» с ручным вводом baseUrl.
   ВАЖНО: перед коммитом сверить префиксы и baseUrl с актуальной
   документацией провайдеров — таблица в плане основана на общеизвестных
   значениях и может устареть.
2. **Детектор провайдера в shared** (`src/shared/lib/ai/provider-detect.*`):
   чистая функция `matchProviders(apiKey)` — сопоставление префиксов
   (самый длинный префикс выигрывает: `sk-or-v1-` бьется раньше `sk-`),
   возвращает список кандидатов (0, 1 или несколько). Функция
   `resolveProvider(apiKey, signal)`: один кандидат → результат сразу, без
   запроса; несколько кандидатов → параллельный probe `GET {baseUrl}/models`
   через переиспользуемую `fetchAvailableModels` (она уже классифицирует
   401/403/сеть), первый успешный ответ побеждает; все неуспешны → `failed`.
   Результат: `resolved(providerId, baseUrl)` | `unsupported(providerId)` |
   `unknown` | `failed`.
3. **Стор детекта** (`src/shared/lib/ai/provider-detect-store.ts` + типы):
   zustand по образцу `models-store`: in-memory на сессию, ключ записи —
   `apiKey`, статусы `idle | detecting | resolved | unsupported | unknown |
   failed`, in-flight дедупликация, AbortController: смена ключа абортит
   старый probe. Повторная вставка того же ключа — из кэша, запроса нет.
4. **Хук `useProviderDetect(apiKey)`** в `src/shared/lib/ai/`: debounce
   после остановки ввода ключа (константа из конфига детекта), вызов
   `ensureDetect`, наружу — статус + resolved-провайдер (id, label, baseUrl).
5. **Форма**: переключатель провайдера удаляется. Вместо него — строка
   состояния детекта: `detecting` (плейсхолдер/спиннер), `resolved` (лейбл
   провайдера из реестра), `unsupported` (сообщение «провайдер пока не
   поддерживается», выбор модели и сабмит заблокированы), `unknown`/`failed`
   (появляется ручной ввод baseUrl — паттерн обычного поля формы; при
   `failed` — короткая подсказка «не удалось определить, введите baseUrl
   вручную»). `ModelSelect` получает `baseUrl` из результата детекта (или из
   ручного ввода). Пропс `provider` у `ModelSelect` удаляется, ключ кэша
   моделей становится `baseUrl|apiKey`. Сабмит возможен только при
   resolved-детекте или заполненном ручном baseUrl.
6. **Удаление provider из данных**: миграция v5 пересоздает `api_templates`
   без колонки `provider` (create new → INSERT SELECT → drop → rename),
   `DB_SCHEMA_VERSION = 5`. Из типов (`ApiTemplate`, `ApiTemplateRow`),
   репозитория (`createTemplate(name, baseUrl, model, apiKey)`), стора
   (`addTemplate(name, baseUrl, model, apiKey)`) и схемы формы `provider`
   удаляется. `baseUrl` пишется в строку как раньше — из результата детекта
   или из ручного ввода.
7. **i18n**: ключ `apiTab.provider` удаляется; добавляются `apiTab.detecting`,
   `apiTab.unsupportedProvider`, `apiTab.detectFailed`, `apiTab.baseUrl`,
   `apiTab.baseUrlPlaceholder` (ru/en).

Чат и стриминг не меняются: `openai-compat-client` и чат-флоу читают
`template.baseUrl` из строки — контракт не меняется.

---

## 2. Задачи

### Задача 1. Реестр провайдеров с префиксами

В `src/shared/config/config.types.ts` заменить `API_TEMPLATE_PRESETS` на
`PROVIDER_REGISTRY`: тип `ApiProviderConfig { id, label, baseUrl, prefixes,
supported }`, реестр — массив (порядок не важен, матчинг по длине префикса).
Тип `ApiTemplateProvider` (юнион из двух id) удаляется. Сверить префиксы и
baseUrl с документацией провайдеров (OpenAI, OpenRouter, DeepSeek, Groq,
Perplexity, HuggingFace router, Gemini OpenAI-compat endpoint). Реэкспорт из
`src/types/api-template.ts` обновить (имена `API_TEMPLATE_PRESETS` /
`ApiTemplatePreset` исчезают — проверить всех импортирующих grep-ом).

Ссылки: `src/shared/config/config.types.ts`, `src/types/api-template.ts`.

### Задача 2. Детектор: типы, конфиг, логика

`src/shared/lib/ai/provider-detect.types.ts` — типы результата детекта
(дискриминированный union из п.1 сводки) и параметров. 
`src/shared/lib/ai/provider-detect.config.ts` — константы: debounce детекта,
таймаут probe (можно переиспользовать `MODELS_REQUEST_TIMEOUT_MS`), минимальная
длина ключа для запуска детекта (согласована с models.config — 20).
`src/shared/lib/ai/provider-detect.ts` — `matchProviders` (чистая функция:
longest-prefix match, регистр не важен, возвращает id кандидатов в порядке
убывания длины префикса) и `resolveProvider` (один кандидат — сразу resolved;
несколько — параллельный probe через `fetchAvailableModels`, первый `ok`
побеждает; `supported: false` у кандидата — сразу `unsupported`, запрос не
делается; все probe неуспешны — `failed`). Логика — только в этом файле,
никаких импортов из `features/` и `app/`.

Ссылки: `src/shared/lib/ai/models.ts` (probe-команда), `models.config.ts`.

### Задача 3. Стор детекта + хук

`src/shared/lib/ai/provider-detect-store.ts` + `provider-detect-store.types.ts`
по образцу `models-store.ts`: Map записей по `apiKey`, статусы из п.1 сводки,
`ensureDetect(apiKey, signal?)` с in-flight дедупликацией и abort при смене
ключа (ответ от старого ключа не перезаписывает состояние новой записи),
кэш на сессию. Хук `useProviderDetect(apiKey)` рядом: debounce из конфига,
запуск `ensureDetect`, отмена при очистке ключа; возвращает `{ status,
provider?, baseUrl? }` (provider — конфиг из реестра, для лейбла).

Ссылки: `src/shared/lib/ai/models-store.ts`, `models-store.types.ts`,
`src/features/api-templates/model/templates-store.ts` (паттерн стора).

### Задача 4. Ключ кэша моделей → `baseUrl|apiKey`

В `models-store.ts` / `models-store.types.ts` / `useModelSelect.ts` /
`ModelSelect.types.ts` / `ModelSelect.tsx`: `modelsCacheKey(baseUrl, apiKey)`,
пропс `provider` у `ModelSelect` удаляется (baseUrl уже есть). Проверить
остальных вызывателей `ensureModels`/`cancelKey`/`modelsCacheKey` grep-ом и
свести на новую сигнатуру.

Ссылки: перечисленные файлы, `src/shared/lib/ai/models-store.types.ts`.

### Задача 5. Форма: удаление переключателя, интеграция детекта

`useTemplateForm.ts` / `TemplateForm.tsx`:

- удалить состояние `provider`/`setProvider` и блок-переключатель из
  `TemplateForm.tsx` (вместе с `apiTab.provider` из i18n);
- подключить `useProviderDetect(apiKey)`; состояние детекта рендерится на
  месте переключателя: `detecting` — ненавязчивый плейсхолдер, `resolved` —
  лейбл провайдера (например, «DeepSeek»), `unsupported` — сообщение
  `apiTab.unsupportedProvider`, при этом `canSubmit = false` и ModelSelect
  заблокирован (`disabled`), `unknown`/`failed` — поле `baseUrl` (тот же
  паттерн TextInput, что остальные поля формы; при `failed` — подсказка
  `apiTab.detectFailed`);
- `ModelSelect` получает `baseUrl` из детекта или из ручного ввода; при
  unknown/failed и пустом baseUrl — заблокирован;
- смена ключа сбрасывает `model` (уже есть) и, если был ручной baseUrl,
  очищает его (новый ключ — новая попытка детекта);
- `canSubmit`: name + model + apiKey + (resolved ИЛИ валидный ручной baseUrl);
- `handleAdd` вызывает `addTemplate(name, resolvedBaseUrl, model, apiKey)`,
  где `resolvedBaseUrl` — из детекта или из поля ручного ввода.

Ссылки: `TemplateForm.tsx`, `useTemplateForm.ts`, `api-tab.animation.ts`
(тайминги не менять).

### Задача 6. Схема формы

`src/schemas/api-template.ts`: удалить `apiTemplateProviderSchema` и поле
`provider`; добавить опциональное `baseUrl: z.string().trim().url()` (или
пустая строка) с `superRefine`: если детект не дал результата (форма в
режиме ручного ввода) и `baseUrl` пустой/невалидный — ошибка на поле
`baseUrl`. Форма передает в схему текущий статус детекта (флаг
«baseUrl обязателен»), чтобы правило не срабатывало при resolved-детекте.

Ссылки: `src/schemas/api-template.ts`, `useTemplateForm.ts`.

### Задача 7. БД: миграция v5 без provider

`src/lib/db/db.config.ts`: `DB_SCHEMA_VERSION = 5`. `src/lib/db/migrations.ts`:
блок `current < 5` — пересоздание `api_templates` без колонки `provider`:
`CREATE TABLE api_templates_new (...)` (схема как v4 минус provider) →
`INSERT INTO api_templates_new SELECT id, name, base_url, model, key_ref,
created_at FROM api_templates` → `DROP TABLE api_templates` →
`ALTER TABLE api_templates_new RENAME TO api_templates`. Данные сохраняются
(ключи в SecureStore не трогаются — key_ref не меняется).

`src/lib/db/templates-repository.ts`: `mapTemplateRow` без provider,
`createTemplate(name, baseUrl, model, apiKey)` — baseUrl приходит параметром,
`API_TEMPLATE_PRESETS` из репозитория удаляется (baseUrl больше не
вычисляется из пресета). Типы `ApiTemplate` / `ApiTemplateRow` в
`src/types/api-template.ts` — без `provider`.

Ссылки: `migrations.ts`, `db.config.ts`, `templates-repository.ts`,
`src/types/api-template.ts`.

### Задача 8. Стор шаблонов и список

`templates-store.ts` + `templates-store.types.ts`: `addTemplate(name,
baseUrl, model, apiKey)`. `TemplateList.tsx`: сабтайтл строки — `model`
без `provider` (если хочется сохранить контекст — хост из baseUrl, но
решение по умолчанию: только model). Проверить остальных потребителей
`template.provider` grep-ом (чат-флоу, FastCheck) — все свести на baseUrl.

Ссылки: `templates-store.ts`, `templates-store.types.ts`,
`TemplateList.tsx`.

### Задача 9. i18n

`en.json` / `ru.json`, секция `apiTab`: удалить `provider`; добавить
`detecting`, `unsupportedProvider`, `detectFailed`, `baseUrl`,
`baseUrlPlaceholder`. Тексты короткие, тон проекта (ru/en пары симметричны).

Ссылки: `src/shared/i18n/messages/en.json`, `ru.json`.

### Задача 10. Минимальные тесты (в конце, не перегружать)

- `matchProviders`: уникальный префикс → один кандидат; `sk-or-v1-` →
  только OpenRouter (longest-prefix); `sk-` → [openai, deepseek] (коллизия);
  `sk-ant-` → unsupported-кандидат; неизвестный ключ → пусто;
- `resolveProvider`: один кандидат — resolved без запроса; коллизия —
  первый успешный probe побеждает (fetch замокать); все probe неуспешны —
  `failed`;
- схема: форма без baseUrl при ручном режиме — ошибка на `baseUrl`;
  с валидным baseUrl — проходит; обновить существующий тест
  (убрать кейсы provider).

Расположение — по существующему паттерну (`tests/`, node:test + assert).

---

## 3. Принципы для исполнителя (обязательно)

- **FSD / типизация**: все типы — в отдельных файлах типов
  (`*.types.ts` / `src/types/`), все константы-конфиги — в отдельных
  конфиг-файлах (`*.config.ts`). В файлах логики и компонентов типов и
  магических констант не оставлять.
- **Переиспользуемость**: детектор, стор детекта и хук не импортируют
  ничего из `features/` и `app/` — только `shared` и `lib`. Probe —
  переиспользование `fetchAvailableModels`, не копия.
- **Приватность**: ключ не логируется, уходит только в `Authorization`
  заголовке на baseUrl провайдеров (параллельный probe — принятое решение).
- **Комментарии**: только на действительно неочевидных местах (why, а не
  what). Комментарий-обоснование оставить у миграции v5 и у решения
  параллельного probe.
- **Дубликаты**: паттерны (стор, debounce, abort, тост, i18n) —
  переиспользовать, не копировать.
- **Документацию не писать и не просить** — она будет делаться после
  полного рефакторинга отдельным шагом.
- **Тесты — в конце, минимальные** (задача 10), агента не перегружать.
