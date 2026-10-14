import type { ChatSearchResult } from '../model/search-store.types';

/**
 * Мержит keyword- и embedding-результаты с приоритизацией:
 * `keyword + embedding` → `keyword-only` → `embedding-only` —
 * первыми идут чаты, подтвержденные обоими этапами. Внутри групп
 * сохраняется порядок релевантности этапа (keyword — порядок из
 * репозитория, embedding — порядок KNN по similarity). У чата,
 * найденного обоими этапами, объединяются источники и сохраняется
 * подсветка keyword-результата.
 */
export function mergeSearchResults(
  keywordResults: ChatSearchResult[],
  embeddingResults: ChatSearchResult[],
): ChatSearchResult[] {
  const embeddingById = new Map(
    embeddingResults.map((result) => [result.chat.id, result]),
  );
  const keywordIds = new Set(keywordResults.map((result) => result.chat.id));

  const both: ChatSearchResult[] = [];
  const keywordOnly: ChatSearchResult[] = [];

  for (const result of keywordResults) {
    const embedding = embeddingById.get(result.chat.id);

    if (!embedding) {
      keywordOnly.push(result);
      continue;
    }

    both.push({
      ...result,
      sources: [...result.sources, ...embedding.sources],
    });
  }

  const embeddingOnly = embeddingResults.filter(
    (result) => !keywordIds.has(result.chat.id),
  );

  return [...both, ...keywordOnly, ...embeddingOnly];
}
