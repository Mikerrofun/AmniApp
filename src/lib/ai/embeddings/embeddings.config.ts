/**
 * Конфигурация embedding-слоя. Модель зафиксирована — смена модели
 * позже делается правкой одной строки здесь.
 */

/** Модель эмбедингов (Cohere Embed API) */
export const EMBEDDING_MODEL = "embed-english-v3.0";

/**
 * Размерность вектора модели. Значение используется миграцией v3
 * для создания векторной таблицы chats_vec — уточнить при первом
 * реальном вызове и при изменении пересоздать таблицу миграцией.
 * Cohere embed-english-v3.0 возвращает векторы размерностью 1024.
 */
export const EMBEDDING_DIMENSIONS = 1024;

/** Порог cosine similarity для embedding-результатов поиска */
export const SIMILARITY_THRESHOLD = 0.75;

/** Base URL Cohere API */
export const EMBEDDINGS_BASE_URL = "https://api.cohere.com/v1";
