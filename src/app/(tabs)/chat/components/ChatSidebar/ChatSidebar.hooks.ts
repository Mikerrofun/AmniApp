import { useCallback, useState } from "react";
import { useWindowDimensions } from "react-native";

import {
  SIDEBAR_DESKTOP_BREAKPOINT,
  SIDEBAR_DESKTOP_WIDTH,
  SIDEBAR_MOBILE_MIN_WIDTH,
  SIDEBAR_MOBILE_RATIO,
} from "./ChatSidebar.config";

export type ChatSidebarController = {
  isOpen: boolean;
  isDesktop: boolean;
  sidebarWidth: number;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

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
