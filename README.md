# AmniApp

Mobile AI chat client built with React Native (Expo) — bring-your-own-key.

## Stack

- Expo SDK 57 + expo-router (file-based routing, similar to Next.js App Router)
- TypeScript (strict), Zod schemas
- NativeWind (Tailwind syntax for React Native)
- Zustand for client state
- expo-secure-store for API keys, expo-sqlite for local chat history (planned)

## Getting started

```bash
pnpm install
pnpm expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Structure

```
src/
├── app/            # routes: (tabs)/chats, (tabs)/settings, chat/[id]
├── components/     # ui/ primitives and chat/ widgets
├── features/       # feature modules (chat, settings)
├── lib/ai/         # provider registry, API client, streaming
├── lib/db/         # local persistence (expo-sqlite repositories)
├── schemas/        # zod schemas shared across the app
├── stores/         # zustand stores
├── hooks/          # shared hooks
└── theme/          # design tokens
```

## Roadmap

1. Settings screen: provider, API key, model, temperature (persisted)
2. Streaming chat via provider APIs (SSE from the device)
3. Local conversation history (expo-sqlite)
4. Markdown rendering + code blocks
5. Proxy base URL option for restricted regions
6. Later: attachments, voice input, agent presets
