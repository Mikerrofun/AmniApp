import type { ComponentType } from "react";

import type { ChatPopoverMode } from "./ChatListItem.types";
import type { ChatPopoverContentProps } from "./ChatItemPopover.types";
import { ChatPopoverDelete } from "./ChatPopoverDelete";
import { ChatPopoverMenu } from "./ChatPopoverMenu";
import { ChatPopoverRename } from "./ChatPopoverRename";

/** Конфиг popover'а чата: какой UI рендерить для какого режима */
export const CHAT_POPOVER_CONTENT: Record<
  ChatPopoverMode,
  ComponentType<ChatPopoverContentProps>
> = {
  menu: ChatPopoverMenu,
  rename: ChatPopoverRename,
  delete: ChatPopoverDelete,
};
