/** Вектор эмбединга */
export type EmbeddingVector = number[];

/** Конфиг embedding-клиента */
export type EmbeddingsClientConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

/**
 * Клиент эмбедингов. Возвращает null, если ключ недоступен —
 * вызывающий код тихо пропускает embedding-этап; сетевые ошибки
 * выбрасываются и обрабатываются вызывающим кодом.
 */
export type EmbeddingsClient = {
  embed: (
    texts: string[],
    signal?: AbortSignal,
  ) => Promise<EmbeddingVector[] | null>;
};
