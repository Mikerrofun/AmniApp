import type { EmbeddingVector } from '@/lib/ai/embeddings';

/**
 * Cosine similarity двух векторов, нормализация внутри функции.
 * Резерв для сравнения в JS: основной путь — KNN-поиск в sqlite-vec.
 */
export function cosineSimilarity(
  a: EmbeddingVector,
  b: EmbeddingVector,
): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
