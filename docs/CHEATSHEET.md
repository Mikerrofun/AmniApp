# 🚀 Шпаргалка по AmniApp

## Быстрые команды

```bash
# Запуск приложения
pnpm start

# Тестирование embeddings
pnpm test:embeddings

# Линтинг
pnpm lint
```

## Структура проекта

```
AmniApp/
├── .env                    # API ключи (не коммитится!)
├── EMBEDDINGS.md           # Настройка поиска
├── src/
│   ├── app/(tabs)/         # Экраны: chats, api, chat
│   ├── features/chats/     # Логика чатов
│   ├── lib/
│   │   ├── ai/embeddings/  # Cohere embeddings
│   │   └── db/             # SQLite репозитории
│   └── shared/i18n/        # Переводы (ru/en)
└── docs/features/          # Документация фич
```

## API ключи

### Для чата (через UI):
1. Вкладка **API** → создать шаблон
2. Ключ сохраняется в **SecureStore** (не в .env!)

### Для поиска (в .env):
```bash
EXPO_PUBLIC_COHERE_API_KEY=cohere_...
```

## Основные компоненты

### Чаты
- **ChatsList** - список чатов с поиском
- **ChatMessages** - переписка
- **ChatInputArea** - инпут + выбор шаблона
- **ChatSidebar** - боковая панель (планшеты)

### API Templates
- **TemplateForm** - создание шаблона
- **TemplateList** - список шаблонов

## Сторы (Zustand)

```typescript
// Чаты + активный чат
useChatsStore()
  .chats               // список чатов
  .activeChatId        // ID активного чата
  .activeNotes         // сообщения активного чата
  .drafts              // черновики по chatId
  .loadChat(id)        // загрузить чат

// Генерация (стриминг)
useGenerationStore()
  .status              // idle | streaming | error
  .streamingText       // накопленный текст
  .errorText           // текст ошибки
  .sendMessage()       // отправить сообщение

// Шаблоны API
useTemplatesStore()
  .templates           // список шаблонов
  .addTemplate()       // создать
  .deleteTemplate()    // удалить
```

## База данных (SQLite)

```typescript
// Чаты
createChat(title, templateId)
getChats()
deleteChat(id)

// Сообщения
appendNote(chatId, role, text)
getNotes(chatId)

// Шаблоны
createTemplate(name, provider, model, apiKey)
getTemplate(id)
deleteTemplate(id)

// Embeddings
updateChatEmbedding(chatId, type, vector)
searchChats(query, signal?)
```

## Миграции БД

Версия схемы: `DB_SCHEMA_VERSION = 4`

```typescript
// src/lib/db/migrations.ts
export const DB_SCHEMA_VERSION = 4;

// История:
// v1: chats + search (FTS5)
// v2: title_vec (embeddings для заголовков)
// v3: chats_vec (embeddings для контекста)
// v4: context/notes, api_templates
```

При изменении схемы: `DB_SCHEMA_VERSION++` и добавить case в switch.

## Embeddings

**Провайдер:** Cohere  
**Модель:** `embed-english-v3.0`  
**Размерность:** 1024

```typescript
// Получить клиент
const client = getEmbeddingsClient();

// Векторизация
const vectors = await client.embed(['text1', 'text2']);

// Без ключа → keyword-поиск (FTS5)
```

## Переводы (i18n)

```typescript
import { useT } from '@/shared/i18n';

const t = useT();
t('chats.title');           // "Чаты" (ru) | "Chats" (en)
t('chatInput.placeholder'); // "Сообщение..." | "Message..."
```

Файлы: `src/shared/i18n/messages/{ru,en}.json`

## Типичные ошибки

### "Provider returned error"
- ✅ Проверь API ключ в шаблоне
- ✅ Проверь название модели
- ✅ Проверь баланс аккаунта

### "Template key missing"
- ✅ Ключ удалён из SecureStore
- ✅ Пересоздай шаблон

### Rate limit (429)
- ✅ OpenRouter без пополнения: 50 req/день
- ✅ С $10: 1000 req/день
- ✅ Подожди до сброса лимита

### Embeddings не работают
- ✅ Проверь `EXPO_PUBLIC_COHERE_API_KEY` в `.env`
- ✅ Запусти `pnpm test:embeddings`
- ✅ Без ключа поиск всё равно работает (keyword-режим)

## Полезные ссылки

- 📖 [API Templates & Chat](./docs/features/api-templates-streaming-chat.md)
- 📖 [Embeddings Setup](./EMBEDDINGS.md)
- 🔑 [OpenRouter Keys](https://openrouter.ai/keys)
- 🔑 [Cohere Keys](https://dashboard.cohere.com/api-keys)
- 📚 [Cohere Docs](https://docs.cohere.com/docs/embeddings)
