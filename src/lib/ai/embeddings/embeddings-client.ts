import { z } from "zod";

import { EMBEDDING_MODEL, EMBEDDINGS_BASE_URL } from "./embeddings.config";
import type {
    EmbeddingsClient,
    EmbeddingsClientConfig,
    EmbeddingVector,
} from "./embeddings.types";

// Cohere API возвращает массив векторов в поле embeddings
const cohereResponseSchema = z.object({
  embeddings: z.array(z.array(z.number())),
});

/**
 * Ключ читается из env конфига (EXPO_PUBLIC_COHERE_API_KEY —
 * стандарт Expo для рантайм-доступных переменных); отсутствие
 * ключа — не ошибка.
 */
function getApiKey(): string | null {
  const apiKey = process.env.EXPO_PUBLIC_COHERE_API_KEY;

  return apiKey ? apiKey : null;
}

/** Есть ли ключ для embedding-вызовов (для быстрой проверки без запроса) */
export function isEmbeddingsAvailable(): boolean {
  return getApiKey() !== null;
}

/**
 * Cohere Embed API клиент для embeddings.
 * Чистая функция поверх fetch, поддержка AbortSignal для отмены устаревших запросов.
 */
export function createEmbeddingsClient(
  config: EmbeddingsClientConfig,
): EmbeddingsClient {
  const embed = async (
    texts: string[],
    signal?: AbortSignal,
  ): Promise<EmbeddingVector[] | null> => {
    const response = await fetch(`${config.baseUrl}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        texts: texts,
        input_type: "search_document", // для индексации документов
        embedding_types: ["float"], // получаем float векторы
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Cohere embeddings request failed: ${response.status} - ${errorText}`,
      );
    }

    const parsed = cohereResponseSchema.parse(await response.json());

    return parsed.embeddings;
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
