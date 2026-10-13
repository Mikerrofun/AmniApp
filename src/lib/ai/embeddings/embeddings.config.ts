/**
 * Конфигурация embedding-слоя. Модель зафиксирована — смена модели
 * позже делается правкой одной строки здесь.
 */

/** Модель эмбедингов (OpenRouter, OpenAI-совместимый /embeddings) */
export const EMBEDDING_MODEL = 'nvidia/nemotron-3-embed-1b:free';

/**
 * Размерность вектора модели. Значение используется миграцией v3
 * для создания векторной таблицы chats_vec — уточнить при первом
 * реальном вызове и при изменении пересоздать таблицу миграцией.
 */
export const EMBEDDING_DIMENSIONS = 4096;

/** Порог cosine similarity для embedding-результатов поиска */
export const SIMILARITY_THRESHOLD = 0.75;

/** Base URL OpenRouter — согласуется с src/lib/ai/providers.ts */
export const EMBEDDINGS_BASE_URL = 'https://openrouter.ai/api/v1';
