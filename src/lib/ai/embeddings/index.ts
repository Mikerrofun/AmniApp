export {
  createEmbeddingsClient,
  getEmbeddingsClient,
  isEmbeddingsAvailable,
} from './embeddings-client';
export {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDINGS_BASE_URL,
  SIMILARITY_THRESHOLD,
} from './embeddings.config';
export type {
  EmbeddingsClient,
  EmbeddingsClientConfig,
  EmbeddingVector,
} from './embeddings.types';
