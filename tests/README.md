# Tests

Централизованная папка для всех тестов проекта.

## Структура

```
tests/
├── api-templates/          # Тесты для фичи "API Templates & Model Selection"
│   ├── api-template-validation.test.ts  # Валидация формы создания шаблона
│   ├── filter-models.test.ts            # Фильтрация списка моделей
│   └── normalize-models.test.ts         # Нормализация данных от API провайдеров
└── README.md
```

## Запуск тестов

### Все тесты
```bash
npx tsx --test tests/**/*.test.ts
```

### Конкретная фича
```bash
npx tsx --test tests/api-templates/**/*.test.ts
```

### Один файл
```bash
npx tsx --test tests/api-templates/filter-models.test.ts
```

## Организация

Тесты группируются по фичам/функциональности:
- `api-templates/` - работа с AI-моделями и шаблонами API
- _(добавляйте новые папки по мере роста проекта)_

## Технологии

- **Test runner**: Node.js native test runner (`node:test`)
- **Execution**: `tsx` для запуска TypeScript
- **Assertions**: `node:assert/strict`
