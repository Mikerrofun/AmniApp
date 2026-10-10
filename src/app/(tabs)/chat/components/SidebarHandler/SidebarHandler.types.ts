export type SidebarHandlerProps = {
  /** Состояние открытия панели */
  isOpen: boolean;
  /** Колбэк закрытия панели */
  onClose: () => void;
  /** Колбэк переключения состояния панели */
  onToggle: () => void;
  /** Десктопный режим (без backdrop) */
  isDesktop: boolean;
  /** Ширина панели */
  sidebarWidth: number;
  /** Отступ сверху для safe area */
  topInset: number;
};
