import { z } from "zod";

import { EMBEDDING_MODEL, EMBEDDINGS_BASE_URL } from "./embeddings.config";
import type {
    EmbeddingsClient,
    EmbeddingsClientConfig,
    EmbeddingVector,
} from "./embeddings.types";

const jinaResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
    }),
  ),
});

function getApiKey(): string | null {
  const apiKey = process.env.EXPO_PUBLIC_JINA_API_KEY;

  return apiKey ? apiKey : null;
}

export function isEmbeddingsAvailable(): boolean {
  return getApiKey() !== null;
}

export function createEmbeddingsClient(
  config: EmbeddingsClientConfig,
): EmbeddingsClient {
  const embed = async (
    texts: string[],
    signal?: AbortSignal,
  ): Promise<EmbeddingVector[] | null> => {
    const response = await fetch(`${config.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        input: texts,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jina embeddings request failed: ${response.status} - ${errorText}`,
      );
    }

    const parsed = jinaResponseSchema.parse(await response.json());

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
