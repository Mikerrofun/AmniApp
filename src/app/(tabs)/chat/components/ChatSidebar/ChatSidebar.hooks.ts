import { useCallback, useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";

import type { SortDirection } from "@/features/chats";
import {
  groupChatsByDay,
  useChatsStore,
  useCreateChat,
} from "@/features/chats";
import type { ChatRecord } from "@/types/chat";

import {
  SIDEBAR_DESKTOP_BREAKPOINT,
  SIDEBAR_DESKTOP_WIDTH,
  SIDEBAR_MOBILE_MIN_WIDTH,
  SIDEBAR_MOBILE_RATIO,
} from "./ChatSidebar.config";

import { useLocaleContext, useT } from "@/shared/i18n";

import type { ChatSidebarController } from "./ChatSidebar.types";

export function useChatSidebar(): ChatSidebarController {
  const { width } = useWindowDimensions();
  const isDesktop = width >= SIDEBAR_DESKTOP_BREAKPOINT;

  const [isOpen, setIsOpen] = useState(isDesktop);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const sidebarWidth = isDesktop
    ? SIDEBAR_DESKTOP_WIDTH
    : Math.max(
        Math.round(width * SIDEBAR_MOBILE_RATIO),
        SIDEBAR_MOBILE_MIN_WIDTH,
      );

  return { isOpen, isDesktop, sidebarWidth, open, close, toggle };
}

/** Секции сгруппированного списка + число закрепленных (сигнал перерисовки) */
export function useChatSections(
  chats: ChatRecord[],
  sortDirection: SortDirection,
) {
  const { locale } = useLocaleContext();
  const t = useT();

  const pinnedCount = useMemo(
    () => chats.filter((chat) => chat.isPinned).length,
    [chats],
  );

  const sections = useMemo(
    () => groupChatsByDay(chats, sortDirection, locale, t("chats.pinned")),
    [chats, sortDirection, locale, t],
  );

  return { sections, pinnedCount };
}

export function useSearchResetOnClose(
  isOpen: boolean,
  resetSearch: () => void,
) {
  useEffect(() => {
    if (!isOpen) resetSearch();
  }, [isOpen, resetSearch]);
}

/** Хендлеры панели: выбор/создание чата и переключение сортировки */
export function useSidebarHandlers(
  onClose: (() => void) | undefined,
  resetSearch: () => void,
) {
  const { createChat } = useCreateChat();
  const setActiveChat = useChatsStore((state) => state.setActiveChat);
  const sortDirection = useChatsStore((state) => state.sortDirection);
  const setSortDirection = useChatsStore((state) => state.setSortDirection);

  const handleSelectChat = useCallback(
    (id: string) => {
      setActiveChat(id);

      resetSearch();
      onClose?.();
    },
    [setActiveChat, resetSearch, onClose],
  );

  const handleCreateChat = useCallback(async () => {
    await createChat();
    onClose?.();
  }, [createChat, onClose]);

  const handleToggleSort = useCallback(() => {
    setSortDirection(sortDirection === "newest" ? "oldest" : "newest");
  }, [sortDirection, setSortDirection]);

  return { handleSelectChat, handleCreateChat, handleToggleSort };
}
