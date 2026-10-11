import type { PopoverAnchor } from "@/shared/components/ui/PopoverMenu";
import type { ChatRecord } from "@/types/chat";
import { Pin } from "lucide-react-native";
import type { ChatPopoverMode } from "./ChatListItem.types";

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
