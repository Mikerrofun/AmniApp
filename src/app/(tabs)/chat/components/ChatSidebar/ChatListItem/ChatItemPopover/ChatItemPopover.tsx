import { PopoverMenu } from "@/shared/components/ui/PopoverMenu";

import { CHAT_POPOVER_WIDTH } from "../ChatListItem.config";
import { CHAT_POPOVER_CONTENT } from "./ChatItemPopover.config";
import type { ChatItemPopoverProps } from "./ChatItemPopover.types";

/**
 * Оболочка popover'а чата: рендерит PopoverMenu и подставляет UI
 * режима из конфига (menu / rename / delete). Логика режимов живет
 * в отдельных компонентах (ChatPopover*).
 */
export function ChatItemPopover({
  chat,
  mode,
  open,
  anchor,
  onClose,
  onModeChange,
  onRename,
  onTogglePin,
  onDelete,
}: ChatItemPopoverProps) {
  /** Закрытие со сбросом режима в menu */
  const close = () => {
    onModeChange("menu");
    onClose();
  };

  const Content = CHAT_POPOVER_CONTENT[mode];

  return (
    <PopoverMenu
      open={open}
      onClose={close}
      anchor={anchor}
      width={CHAT_POPOVER_WIDTH}
    >
      <Content
        chat={chat}
        close={close}
        onModeChange={onModeChange}
        onRename={onRename}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    </PopoverMenu>
  );
}
