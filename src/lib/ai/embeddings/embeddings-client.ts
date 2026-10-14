import { z } from 'zod';

import { EMBEDDINGS_BASE_URL, EMBEDDING_MODEL } from './embeddings.config';
import type {
  EmbeddingsClient,
  EmbeddingsClientConfig,
  EmbeddingVector,
} from './embeddings.types';

const embeddingsResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })),
});

/**
 * Ключ читается из env конфига (EXPO_PUBLIC_OPENROUTER_API_KEY —
 * стандарт Expo для рантайм-доступных переменных); отсутствие
 * ключа — не ошибка.
 */
function getApiKey(): string | null {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

  return apiKey ? apiKey : null;
}

/** Есть ли ключ для embedding-вызовов (для быстрой проверки без запроса) */
export function isEmbeddingsAvailable(): boolean {
  return getApiKey() !== null;
}

/**
 * OpenAI-совместимый клиент POST /embeddings. Чистая функция поверх
 * fetch, поддержка AbortSignal для отмены устаревших запросов.
 */
export function createEmbeddingsClient(
  config: EmbeddingsClientConfig,
): EmbeddingsClient {
  const embed = async (
    texts: string[],
    signal?: AbortSignal,
  ): Promise<EmbeddingVector[] | null> => {
    const response = await fetch(`${config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, input: texts }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Embeddings request failed: ${response.status}`);
    }

    const parsed = embeddingsResponseSchema.parse(await response.json());

    return parsed.data.map((item) => item.embedding);
  };

  return { embed };
}

/**
 * Клиент поверх env-конфига проекта. Без ключа возвращает null —
 * embedding-этап тихо пропускается, keyword-поиск не зависит от него.
 */
export function getEmbeddingsClient(): EmbeddingsClient | null {
  const apiKey = getApiKey();

  if (!apiKey) return null;

  return createEmbeddingsClient({
    baseUrl: EMBEDDINGS_BASE_URL,
    apiKey,
    model: EMBEDDING_MODEL,
  });
}
