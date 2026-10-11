/** Чат как он хранится в БД (camelCase-представление для приложения) */
export type ChatRecord = {
  id: string;
  title: string;
  isPinned: boolean;
  /** Черновик сообщения — сохраняется автоматически при наборе */
  draft: string | null;
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
  draft: string | null;
  created_at: number;
  updated_at: number;
};
