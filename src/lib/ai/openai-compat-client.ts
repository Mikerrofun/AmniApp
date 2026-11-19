import { fetch } from 'expo/fetch';

import { isRetryableError, withRetry } from '@/shared/lib/net';
import {
  chatCompletionChunkSchema,
  chatCompletionErrorSchema,
} from '@/schemas/api-template';
import type {
  ChatCompletionConfig,
  ChatCompletionErrorInfo,
} from '@/types/api-template';

/**
 * Нормализованная ошибка запроса: HTTP-статус + текст API.
 * partialText — накопленный до ошибки текст, он не теряется.
 */
export class ChatCompletionError
  extends Error
  implements ChatCompletionErrorInfo
{
  status?: number;
  partialText: string;

  constructor(info: ChatCompletionErrorInfo) {
    super(info.message);
    this.name = 'ChatCompletionError';
    this.status = info.status;
    this.partialText = info.partialText;
  }
}

/** Достает человекочитаемый текст из тела ошибки API (если удалось распарсить) */
function extractApiMessage(raw: string): string | null {
  try {
    const parsed = chatCompletionErrorSchema.parse(JSON.parse(raw));

    return parsed.error?.message ?? null;
  } catch {
    return null;
  }
}

/**
 * Разбирает буфер SSE-событий и возвращает дельты контента.
 * Формат OpenAI: строки `data: <json>`, завершение — `data: [DONE]`.
 */
function parseSseDataLines(
  buffer: string,
): { payloads: string[]; rest: string; done: boolean } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const payloads: string[] = [];
  let done = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice('data:'.length).trim();

    if (payload === '[DONE]') {
      done = true;
      continue;
    }

    payloads.push(payload);
  }

  return { payloads, rest, done };
}

/**
 * OpenAI-совместимый стриминговый клиент POST {baseUrl}/chat/completions.
 * Ручной парсинг SSE, валидация чанков zod-схемой. Колбэк получает
 * накопленный текст по мере прихода дельт (токен-за-токеном).
 * Возвращает полный текст ответа.
 */
export async function streamChatCompletion(
  config: ChatCompletionConfig,
  onText: (accumulatedText: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // Ретрай только до первой дельты: после нее повтор продублирует текст.
  // До первой дельты ретраятся сеть/таймаут/5xx/429 на начальном fetch —
  // POST /chat/completions серверной стороны не мутирует. 4xx и внешний
  // abort — наверх сразу.
  let emitted = false;
  const handleText = (text: string) => {
    emitted = true;
    onText(text);
  };

  const { reader, firstChunk } = await withRetry(
    async () => {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: config.messages,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const raw = await response.text();
        const apiMessage = extractApiMessage(raw);

        throw new ChatCompletionError({
          status: response.status,
          message: apiMessage ?? (raw ? raw.slice(0, 300) : 'Request failed'),
          partialText: '',
        });
      }

      if (!response.body) {
        throw new ChatCompletionError({
          message: 'Response has no body',
          partialText: '',
        });
      }

      const attemptReader = response.body.getReader();
      const firstRead = await attemptReader.read();

      return { reader: attemptReader, firstChunk: firstRead };
    },
    {
      signal,
      shouldRetry: (error) => !emitted && isRetryableError(error),
    },
  );

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let done = false;

  const handleChunk = (value: Uint8Array): void => {
    buffer += decoder.decode(value, { stream: true });

    const { payloads, rest, done: sawDone } = parseSseDataLines(buffer);
    buffer = rest;
    done = sawDone;

    for (const payload of payloads) {
      let json: unknown;

      try {
        json = JSON.parse(payload);
      } catch {
        // Не-JSON строка потока — пропускаем
        continue;
      }

      const parsed = chatCompletionChunkSchema.safeParse(json);

      if (!parsed.success) continue;

      for (const choice of parsed.data.choices) {
        const delta = choice.delta?.content;

        if (delta) {
          accumulated += delta;
          handleText(accumulated);
        }
      }
    }
  };

  if (!firstChunk.done) handleChunk(firstChunk.value);

  while (!done) {
    const { value, done: streamDone } = await reader.read();

    if (streamDone) break;

    handleChunk(value);
  }

  return accumulated;
}
