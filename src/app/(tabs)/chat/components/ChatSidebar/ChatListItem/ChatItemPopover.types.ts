import type { ChatRecord } from '@/types/chat';

import type { ChatPopoverMode } from './ChatListItem.types';
import type { PopoverAnchor } from '@/shared/components/ui/PopoverMenu';
import type { Pin } from 'lucide-react-native';

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

export type MenuItemProps = {
  icon: typeof Pin;
  label: string;
  danger?: boolean;
  onPress: () => void;
};

/** Общие пропсы UI-компонентов режимов popover'а */
export type ChatPopoverContentProps = {
  chat: ChatRecord;
  /** Закрытие со сбросом режима в menu */
  close: () => void;
  onModeChange: (mode: ChatPopoverMode) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (chat: ChatRecord) => void;
  onDelete: (id: string) => void;
};
