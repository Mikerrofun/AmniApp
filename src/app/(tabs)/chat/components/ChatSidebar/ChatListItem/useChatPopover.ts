import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import { useChatsStore } from "@/features/chats";

import { usePopoverAnchor } from "@/shared/components/ui/PopoverMenu";

import type { ChatPopoverMode } from "./ChatListItem.types";

const INITIAL_POPOVER = { open: false, mode: "menu" as ChatPopoverMode };

/**
 * Ручки popover'а элемента чата: состояние (открыт/режим), якорь для
 * позиционирования и hover-статус. Компонент только подключает их,
 * логика открытия/закрытия живет здесь.
 *
 * Авто-rename нового чата: сигнал стора (pendingRenameChatId) выводит
 * popover в режим rename напрямую — состояние производное, без эффекта
 * и каскадного рендера. Завершение такого rename (Save/Cancel/закрытие)
 * гасит сигнал и вызывает onRenameComplete; обычные rename поведение
 * панели не меняют.
 */
export function useChatPopover(chatId: string, onRenameComplete?: () => void) {
  const { anchorRef, anchor, measure } = usePopoverAnchor();

  const [popover, setPopover] = useState(INITIAL_POPOVER);
  const [isHovered, setIsHovered] = useState(false);

  const pendingRenameChatId = useChatsStore(
    (state) => state.pendingRenameChatId,
  );
  const consumePendingRename = useChatsStore(
    (state) => state.consumePendingRename,
  );

  const isAutoRename = pendingRenameChatId === chatId;
  const effectivePopover = isAutoRename
    ? { open: true, mode: "rename" as ChatPopoverMode }
    : popover;

  const openPopover = useCallback(
    (mode: ChatPopoverMode) => {
      measure();
      setPopover({ open: true, mode });
    },
    [measure],
  );

  // На web якорь (кнопка меню) монтируется только при открытом popover'е,
  // поэтому после открытия домеряем, когда он появился
  useEffect(() => {
    if (effectivePopover.open && !anchor) measure();
  }, [effectivePopover.open, anchor, measure]);

  /**
   * Закрытие popover'а. В авто-rename потоке попутно завершает его:
   * сигнал гасится, панель закрывается — и после Save, и после Cancel,
   * и по тапу вне.
   */
  const handlePopoverClose = useCallback(() => {
    if (isAutoRename) {
      consumePendingRename(chatId);
      onRenameComplete?.();
      return;
    }

    setPopover(INITIAL_POPOVER);
  }, [isAutoRename, consumePendingRename, chatId, onRenameComplete]);

  const setMode = useCallback(
    (mode: ChatPopoverMode) => setPopover((prev) => ({ ...prev, mode })),
    [],
  );

  const hoverHandlers = {
    onHoverIn: () => setIsHovered(true),
    onHoverOut: () => setIsHovered(false),
  };

  /** На web кнопка меню видна на hover или при открытом popover'е */
  const showDots =
    Platform.OS === "web" ? isHovered || effectivePopover.open : true;

  return {
    anchorRef,
    anchor,
    hoverHandlers,
    popover: effectivePopover,
    openPopover,
    handlePopoverClose,
    setMode,
    showDots,
  };
}
