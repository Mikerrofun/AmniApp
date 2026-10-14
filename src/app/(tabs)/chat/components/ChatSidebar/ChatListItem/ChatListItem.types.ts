import type { TitleSegment } from '@/features/chats';
import type { ChatRecord } from '@/types/chat';

export type ChatListItemProps = {
  chat: ChatRecord;
  /** Чат выбран активным — подсветка */
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /**
   * Завершение авто-rename нового чата (Save/Cancel/закрытие popover'а):
   * панель закрывается. На обычные rename из меню не реагирует.
   */
  onRenameComplete?: () => void;
  onTogglePin: (chat: ChatRecord) => void;
  onDelete: (id: string) => void;
  /**
   * Сегменты названия с подсветкой совпадений (результаты поиска).
   * Без пропа название рендерится обычным текстом.
   */
  titleSegments?: TitleSegment[];
};

/** Режим содержимого popover'а чата */
export type ChatPopoverMode = 'menu' | 'rename' | 'delete';
