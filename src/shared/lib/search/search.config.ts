/**
 * Конфигурация поискового слоя (FTS5 + sqlite-vec).
 * Общие константы матчинга: используются репозиторием БД и UI-разбором
 * подсветки, поэтому живут в shared, а не рядом с конкретным хранилищем.
 */

/**
 * Маркеры, которыми FTS5 highlight() оборачивает совпадения.
 * Используются и в SQL-запросе, и при разборе title на сегменты
 * подсветки в UI (src/features/chats/lib/highlighted-title.ts).
 */
export const FTS_HIGHLIGHT_START = '\u0001';
export const FTS_HIGHLIGHT_END = '\u0002';

/** Максимальное число результатов keyword-поиска */
export const KEYWORD_SEARCH_LIMIT = 50;

/** Максимальное число кандидатов KNN-поиска по эмбедингам */
export const EMBEDDING_SEARCH_LIMIT = 50;

/**
 * Минимальная длина токена для префиксного поиска: префикс из 1–2
 * символов дает слишком много шума, короткие токены ищутся точно.
 */
export const PREFIX_SEARCH_MIN_LENGTH = 3;
