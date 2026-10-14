import type { ChatRecord } from '@/types/chat';

/** Источник совпадения чата в поиске */
export type ChatSearchSource = 'keyword' | 'embedding';

/** Диапазон совпадения в названии (символьные индексы, end не включается) */
export type TitleMatchRange = { start: number; end: number };

/** Сегмент названия для рендера подсветки */
export type TitleSegment = { text: string; isMatch: boolean };

/** Единый тип результата для keyword- и embedding-этапов поиска */
export type ChatSearchResult = {
  chat: ChatRecord;
  sources: ChatSearchSource[];
  /** Диапазоны совпадений в title (только у keyword-результатов) */
  titleRanges: TitleMatchRange[];
  /** Релевантность: similarity для embedding; у keyword порядок из репозитория */
  score: number;
};

/**
 * Состояние поиска. Поисковая строка — временное состояние в памяти
 * (как драфты), без записи в БД.
 */
export type SearchState = {
  query: string;
  keywordResults: ChatSearchResult[];
  embeddingResults: ChatSearchResult[];
  /** Идет embedding-этап поиска (keyword выполняется мгновенно) */
  isSearching: boolean;

  searchByKeywords: (query: string) => Promise<void>;
  searchByEmbeddings: (query: string, signal: AbortSignal) => Promise<void>;
  clearSearch: () => void;
};
