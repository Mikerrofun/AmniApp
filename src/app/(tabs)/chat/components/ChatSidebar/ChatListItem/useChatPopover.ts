import { useCallback, useState } from "react";
import { Platform } from "react-native";

import { usePopoverAnchor } from "@/shared/components/ui/PopoverMenu";

import type { ChatPopoverMode } from "./ChatListItem.types";

const INITIAL_POPOVER = { open: false, mode: "menu" as ChatPopoverMode };

/**
 * Ручки popover'а элемента чата: состояние (открыт/режим), якорь для
 * позиционирования и hover-статус. Компонент только подключает их,
 * логика открытия/закрытия живет здесь.
 */
export function useChatPopover() {
  const { anchorRef, anchor, measure } = usePopoverAnchor();

  const [popover, setPopover] = useState(INITIAL_POPOVER);
  const [isHovered, setIsHovered] = useState(false);

  const openPopover = useCallback(
    (mode: ChatPopoverMode) => {
      measure();
      setPopover({ open: true, mode });
    },
    [measure],
  );

  const closePopover = useCallback(() => setPopover(INITIAL_POPOVER), []);

  const setMode = useCallback(
    (mode: ChatPopoverMode) => setPopover((prev) => ({ ...prev, mode })),
    [],
  );

  const hoverHandlers = {
    onHoverIn: () => setIsHovered(true),
    onHoverOut: () => setIsHovered(false),
  };

  /** На web кнопка меню видна на hover или при открытом popover'е */
  const showDots = Platform.OS === "web" ? isHovered || popover.open : true;

  return {
    anchorRef,
    anchor,
    hoverHandlers,
    popover,
    openPopover,
    closePopover,
    setMode,
    showDots,
  };
}
