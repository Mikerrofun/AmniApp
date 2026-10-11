import type { ChatRecord } from '@/types/chat';

/** Направление сортировки списка чатов */
export type SortDirection = 'newest' | 'oldest';

export type ChatsState = {
  chats: ChatRecord[];
  /** Активный (выбранный) чат, null — ничего не выбрано */
  activeChatId: string | null;
  sortDirection: SortDirection;
  isLoading: boolean;
  /**
   * Чат, чье поле ввода нужно сфокусировать (заполняется при создании чата).
   * ChatInputArea при монтировании проверяет совпадение и снимает флаг —
   * так фокус не срабатывает при обычном переключении чатов.
   */
  focusChatId: string | null;
  /**
   * Черновики в памяти (сессионное состояние, аналог sessionStorage):
   * переживают переключение чатов и вкладок, стираются при рестарте.
   */
  drafts: Record<string, string>;
  /** Черновик временного чата (когда активный чат не выбран) */
  globalDraft: string;

  loadChats: () => Promise<void>;
  createChat: (title: string) => Promise<ChatRecord>;
  renameChat: (id: string, title: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  setPinned: (id: string, isPinned: boolean) => Promise<void>;
  setDraft: (id: string, draft: string) => void;
  setGlobalDraft: (draft: string) => void;
  setActiveChat: (id: string | null) => void;
  setSortDirection: (direction: SortDirection) => void;
  consumeFocusChat: (id: string) => void;
};
