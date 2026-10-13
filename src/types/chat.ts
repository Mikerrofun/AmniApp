/** Чат как он хранится в БД (camelCase-представление для приложения) */
export type ChatRecord = {
  id: string;
  title: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
};

/** Сообщение чата (логики сообщений пока нет — таблица создана заранее) */
export type ChatMessageRecord = {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
};

/** Строка таблицы chats — snake_case, как в SQLite */
export type ChatRow = {
  id: string;
  title: string;
  is_pinned: number;
  created_at: number;
  updated_at: number;
  /** Денормализованный текст всех сообщений чата (поисковый индекс) */
  context: string;
  /** JSON-вектор эмбединга названия; NULL — еще не сгенерирован */
  title_embedding: string | null;
  /** JSON-вектор эмбединга контекста; NULL — задел на будущее */
  context_embedding: string | null;
};

/** Какой эмбединг чата сравнивается в embedding-поиске */
export type ChatEmbeddingKind = 'title' | 'context';

/** Строка keyword-поиска: чат + title с маркерами совпадений от FTS5 */
export type ChatKeywordSearchRow = {
  id: string;
  title: string;
  is_pinned: number;
  created_at: number;
  updated_at: number;
  /** title, в котором совпадения обернуты маркерами подсветки */
  highlighted_title: string;
};

/** Результат keyword-поиска (camelCase-представление для приложения) */
export type ChatKeywordSearchRecord = {
  chat: ChatRecord;
  /** title с маркерами совпадений от FTS5 highlight() */
  highlightedTitle: string;
};

/** Строка embedding-поиска (KNN по chats_vec, JOIN с chats) */
export type ChatEmbeddingSearchRow = {
  id: string;
  title: string;
  is_pinned: number;
  created_at: number;
  updated_at: number;
  /** Cosine distance из sqlite-vec: чем меньше, тем ближе */
  distance: number;
};

/** Результат embedding-поиска (camelCase-представление для приложения) */
export type ChatEmbeddingSearchRecord = {
  chat: ChatRecord;
  /** Cosine similarity 0..1 */
  similarity: number;
};
