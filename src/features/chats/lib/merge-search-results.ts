import type { ChatSearchResult } from '../model/search-store.types';

/**
 * Мержит keyword- и embedding-результаты: dedupe по id чата, у чата,
 * найденного обоими этапами, объединяются источники (приоритет у
 * keyword-результата — подсветка по диапазонам). Keyword-результаты
 * сохраняют порядок релевантности, embedding-only добавляются после.
 */
export function mergeSearchResults(
  keywordResults: ChatSearchResult[],
  embeddingResults: ChatSearchResult[],
): ChatSearchResult[] {
  const merged = new Map<string, ChatSearchResult>();

  for (const result of keywordResults) {
    merged.set(result.chat.id, result);
  }

  for (const result of embeddingResults) {
    const existing = merged.get(result.chat.id);

    merged.set(
      result.chat.id,
      existing
        ? { ...existing, sources: [...existing.sources, ...result.sources] }
        : result,
    );
  }

  return [...merged.values()];
}
