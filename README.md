# AmniApp

Mobile AI chat client built with React Native (Expo) — bring-your-own-key.

## Stack

- Expo SDK 57 + expo-router (file-based routing, similar to Next.js App Router)
- TypeScript (strict), Zod schemas
- NativeWind (Tailwind syntax for React Native)
- Zustand for client state
- expo-secure-store for API keys, expo-sqlite for local chat history
- Cohere Embeddings API for semantic search

## Getting started

```bash
pnpm install

# Добавьте API ключи в .env (см. .env.example)
# EXPO_PUBLIC_COHERE_API_KEY=your_key  # для поиска по чатам

pnpm expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Features

✅ **Чаты с AI моделями**

- Поддержка OpenRouter и других OpenAI-совместимых провайдеров
- Streaming ответов (SSE)
- Сохранение истории в локальной БД (SQLite)
- Черновики сообщений

✅ **Поиск по чатам**

- FTS5 keyword-поиск (всегда работает)
- Semantic search через Cohere embeddings (опционально)
- Векторный поиск по cosine similarity

✅ **API Templates**

- Безопасное хранение ключей (expo-secure-store)
- Множественные шаблоны (провайдер + модель)
- Выбор шаблона для каждого чата

📖 **Документация:**

- [Embeddings Setup](./EMBEDDINGS.md) - настройка поиска
- [API Templates & Chat](./docs/features/api-templates-streaming-chat.md) - как работает чат

## Structure

```
src/
├── app/            # routes: (tabs)/chats, (tabs)/settings, (tabs)/api
├── features/       # feature modules (chats, api-templates)
├── lib/
│   ├── ai/         # provider clients, embeddings
│   └── db/         # SQLite repositories, migrations
├── schemas/        # zod schemas
└── shared/         # ui, i18n, components
```

## Environment Variables

```bash
# .env
EXPO_PUBLIC_COHERE_API_KEY=cohere_...  # для embeddings (опционально)
```

API ключи для chat провайдеров хранятся в expo-secure-store через UI приложения.

## Testing

```bash
# Проверка Cohere Embeddings API
pnpm test:embeddings
```
