# Миграция на Cohere Embeddings

**Дата:** 20.10.2026  
**Теги:** #embeddings #cohere #migration

---

## Что изменилось

Embedding-слой переведен с HuggingFace на **Cohere API** из-за проблем с доступностью `api-inference.huggingface.co` в некоторых регионах.

## Новая конфигурация

### Модель
- **Провайдер:** Cohere
- **Модель:** `embed-english-v3.0`
- **Размерность:** 1024
- **Base URL:** `https://api.cohere.com/v1`

### API ключ
```bash
# .env
EXPO_PUBLIC_COHERE_API_KEY=cohere_...
```

Получить ключ: https://dashboard.cohere.com/api-keys

### Бесплатный план Cohere
- **Лимиты Trial ключа:**
  - 100 запросов/месяц для Trial API keys
  - Для больших лимитов: Production API key (требует карту, но остается бесплатным в рамках лимитов)
  
- **Production API key (рекомендуется):**
  - 1000 запросов/месяц бесплатно
  - После превышения: $0.10 за 1000 embeddings

## Изменённые файлы

### 1. `src/lib/ai/embeddings/embeddings.config.ts`
```typescript
export const EMBEDDING_MODEL = "embed-english-v3.0";
export const EMBEDDING_DIMENSIONS = 1024;
export const EMBEDDINGS_BASE_URL = "https://api.cohere.com/v1";
```

### 2. `src/lib/ai/embeddings/embeddings-client.ts`
- Изменен формат запроса под Cohere API
- Изменено имя env-переменной: `EXPO_PUBLIC_COHERE_API_KEY`
- Формат запроса:
  ```json
  {
    "model": "embed-english-v3.0",
    "texts": ["text1", "text2"],
    "input_type": "search_document",
    "embedding_types": ["float"]
  }
  ```

### 3. `.env.example`
```bash
EXPO_PUBLIC_COHERE_API_KEY=
```

### 4. Тестовый скрипт
- Создан: `test-cohere-embeddings.sh`
- Удален: `test-huggingface-embeddings.sh`
- Команда: `pnpm test:embeddings`

## Формат ответа Cohere

```json
{
  "id": "...",
  "texts": ["Hello world"],
  "embeddings": {
    "float": [
      [0.123, -0.456, 0.789, ...]  // 1024 числа
    ]
  },
  "meta": {...}
}
```

## Совместимость

✅ **Размерность не изменилась:** 1024 (как и была у HuggingFace BAAI/bge-m3)  
✅ **Миграция БД не требуется:** таблица `chats_vec` уже использует 1024 размерность  
✅ **Старые эмбеддинги совместимы:** можно продолжать использовать существующие векторы

## Преимущества Cohere

- ✅ Доступен без VPN в России
- ✅ Стабильный API без rate-limiting на бесплатных моделях (в рамках лимитов)
- ✅ Официальная поддержка и документация
- ✅ Высокое качество эмбеддингов для поиска
- ✅ Специализированные input_type для разных задач

## Тестирование

```bash
# Через скрипт (ключ из .env)
pnpm test:embeddings

# Вручную
curl -X POST "https://api.cohere.com/v1/embed" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "model": "embed-english-v3.0",
    "texts": ["Hello world"],
    "input_type": "search_document",
    "embedding_types": ["float"]
  }'
```

## Откат (если нужно)

Чтобы вернуться на HuggingFace (если появится доступ):

1. В `.env`:
   ```bash
   EXPO_PUBLIC_HUGGINFACE_API_KEY=hf_...
   ```

2. В `embeddings.config.ts`:
   ```typescript
   export const EMBEDDING_MODEL = "BAAI/bge-m3";
   export const EMBEDDINGS_BASE_URL = "https://api-inference.huggingface.co";
   ```

3. В `embeddings-client.ts`:
   - Изменить `process.env.EXPO_PUBLIC_COHERE_API_KEY` → `EXPO_PUBLIC_HUGGINFACE_API_KEY`
   - Изменить формат запроса обратно на HuggingFace
