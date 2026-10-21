import { create } from "zustand";

import { getEmbeddingsClient } from "@/lib/ai/embeddings";
import { searchChatsByEmbedding, searchChatsByKeywords } from "@/lib/db";

import { parseHighlightedTitle } from "../lib/highlighted-title";
import type { ChatSearchResult, SearchState } from "./search-store.types";

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  keywordResults: [],
  embeddingResults: [],
  isSearching: false,

  searchByKeywords: async (query) => {
    set({ query });

    try {
      const records = await searchChatsByKeywords(query);
      const results: ChatSearchResult[] = records.map((record) => ({
        chat: record.chat,
        sources: ["keyword"],
        titleRanges: parseHighlightedTitle(record.highlightedTitle),
        score: 0,
      }));

      set((state) =>
        state.query === query ? { keywordResults: results } : {},
      );
    } catch {
      set((state) => (state.query === query ? { keywordResults: [] } : {}));
    }
  },

  searchByEmbeddings: async (query, signal) => {
    const client = getEmbeddingsClient();

    // Нет ключа в env — embedding-этап тихо пропускается
    if (!client) return;

    set({ isSearching: true });

    try {
      const vectors = await client.embed([query], signal);
      const vector = vectors?.[0];

      if (!vector || signal.aborted) return;

      const records = await searchChatsByEmbedding(vector);
      const results: ChatSearchResult[] = records.map((record) => ({
        chat: record.chat,
        sources: ["embedding"],
        titleRanges: [],
        score: record.similarity,
      }));

      if (signal.aborted) return;

      set((state) =>
        state.query === query ? { embeddingResults: results } : {},
      );
    } catch (error) {
      // Ошибка сети/запроса не должна ломать keyword-поиск
      if (!signal.aborted) set({ embeddingResults: [] });
    } finally {
      if (!signal.aborted) set({ isSearching: false });
    }
  },

  clearSearch: () =>
    set({
      query: "",
      keywordResults: [],
      embeddingResults: [],
      isSearching: false,
    }),
}));
