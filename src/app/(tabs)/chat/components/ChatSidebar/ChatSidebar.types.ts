/** Сводка чата — задел под будущий список чатов в панели */
export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: number;
};

export type ChatSidebarController = {
  isOpen: boolean;
  isDesktop: boolean;
  sidebarWidth: number;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export type ChatSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  /** true — десктоп/веб (без затемнения фона); false — телефон (с затемнением) */
  isDesktop: boolean;
  /** Ширина панели в открытом состоянии */
  sidebarWidth: number;
  /** Будущая логика: создание нового чата */
  onCreateChat?: () => void;
  /** Будущая логика: выбор чата из истории */
  onSelectChat?: (chatId: string) => void;
  /** Будущая логика: поиск по чатам */
  onSearch?: (query: string) => void;
  className?: string;
};

export type ChatSidebarTriggerProps = {
  /** Панель открыта — кнопка отображается как крестик для закрытия */
  isOpen: boolean;
  onPress: () => void;
  className?: string;
};

/** Пропсы для внутреннего компонента SidebarContent */
export type SidebarContentProps = Pick<
  ChatSidebarProps,
  "onCreateChat" | "onSearch"
>;
