import { useCallback, useEffect, useMemo, useRef } from 'react';

import { mergeSearchResults } from '../lib/merge-search-results';
import { useSearchStore } from './search-store';
import { EMBEDDING_SEARCH_DEBOUNCE_MS } from './use-chat-search.config';

/**
 * Единственная точка входа UI в поиск. Keyword-поиск выполняется
 * немедленно на каждый ввод (локальный FTS — дешево), embedding-поиск —
 * с дебаунсом после остановки печати; каждый новый ввод сбрасывает
 * таймер и прерывает предыдущий embedding-запрос через AbortController.
 */
export function useChatSearch() {
  const query = useSearchStore((state) => state.query);
  const keywordResults = useSearchStore((state) => state.keywordResults);
  const embeddingResults = useSearchStore((state) => state.embeddingResults);
  const isSearching = useSearchStore((state) => state.isSearching);
  const searchByKeywords = useSearchStore((state) => state.searchByKeywords);
  const searchByEmbeddings = useSearchStore((state) => state.searchByEmbeddings);
  const clearSearch = useSearchStore((state) => state.clearSearch);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelPendingEmbeddingSearch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      cancelPendingEmbeddingSearch();

      if (text.trim() === '') {
        clearSearch();
        return;
      }

      void searchByKeywords(text);

      debounceRef.current = setTimeout(() => {
        const controller = new AbortController();
        abortRef.current = controller;

        void searchByEmbeddings(text, controller.signal);
      }, EMBEDDING_SEARCH_DEBOUNCE_MS);
    },
    [
      cancelPendingEmbeddingSearch,
      clearSearch,
      searchByEmbeddings,
      searchByKeywords,
    ],
  );

  /** Полный сброс поиска — при выборе чата и закрытии панели */
  const resetSearch = useCallback(() => {
    cancelPendingEmbeddingSearch();
    clearSearch();
  }, [cancelPendingEmbeddingSearch, clearSearch]);

  useEffect(() => cancelPendingEmbeddingSearch, [cancelPendingEmbeddingSearch]);

  const results = useMemo(
    () => mergeSearchResults(keywordResults, embeddingResults),
    [keywordResults, embeddingResults],
  );

  return { query, results, isSearching, handleChangeText, resetSearch };
}
