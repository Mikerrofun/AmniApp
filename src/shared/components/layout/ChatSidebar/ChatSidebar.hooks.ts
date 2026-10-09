import { useCallback, useState } from 'react';
import { useWindowDimensions } from 'react-native';

/** Начиная с этой ширины экрана панель считается десктопной и открыта по умолчанию */
export const SIDEBAR_DESKTOP_BREAKPOINT = 900;
/** Доля ширины экрана, которую панель занимает на телефоне */
export const SIDEBAR_MOBILE_RATIO = 0.7;
export const SIDEBAR_MOBILE_MIN_WIDTH = 240;
export const SIDEBAR_DESKTOP_WIDTH = 280;

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

  // На десктопе панель открыта изначально, на телефоне — закрыта
  const [isOpen, setIsOpen] = useState(isDesktop);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const sidebarWidth = isDesktop
    ? SIDEBAR_DESKTOP_WIDTH
    : Math.max(Math.round(width * SIDEBAR_MOBILE_RATIO), SIDEBAR_MOBILE_MIN_WIDTH);

  return { isOpen, isDesktop, sidebarWidth, open, close, toggle };
}
