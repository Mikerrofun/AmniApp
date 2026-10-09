/** Сводка чата — задел под будущий список чатов в панели */
export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: number;
};

export type ChatSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  /** true — панель встроена в layout (десктоп/веб); false — оверлей поверх контента (телефон) */
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
  onPress: () => void;
  className?: string;
};
