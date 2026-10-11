import type { ChatRecord } from '@/types/chat';

import type { ChatPopoverMode } from './ChatListItem.types';
import type { PopoverAnchor } from '@/shared/components/ui/PopoverMenu';

export type ChatItemPopoverProps = {
  chat: ChatRecord;
  mode: ChatPopoverMode;
  open: boolean;
  anchor: PopoverAnchor | null;
  onClose: () => void;
  onModeChange: (mode: ChatPopoverMode) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (chat: ChatRecord) => void;
  onDelete: (id: string) => void;
};
