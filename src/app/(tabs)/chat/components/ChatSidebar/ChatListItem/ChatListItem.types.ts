import type { ChatRecord } from '@/types/chat';

export type ChatListItemProps = {
  chat: ChatRecord;
  /** Чат выбран активным — подсветка */
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (chat: ChatRecord) => void;
  onDelete: (id: string) => void;
};

/** Режим содержимого popover'а чата */
export type ChatPopoverMode = 'menu' | 'rename' | 'delete';
