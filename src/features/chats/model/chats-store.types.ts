import type { ApiTemplate } from '@/types/api-template';
import type { ChatRecord, NoteRecord } from '@/types/chat';

/** Направление сортировки списка чатов */
export type SortDirection = 'newest' | 'oldest';

export type ChatsState = {
  chats: ChatRecord[];
  /** Активный (выбранный) чат, null — ничего не выбрано */
  activeChatId: string | null;
  sortDirection: SortDirection;
  isLoading: boolean;
  /**
   * Чат, чье поле ввода нужно сфокусировать (заполняется при создании чата).
   * ChatInputArea при монтировании проверяет совпадение и снимает флаг —
   * так фокус не срабатывает при обычном переключении чатов.
   */
  focusChatId: string | null;
  /**
   * Счетчик запросов фокуса поля ввода временного чата. Инкрементится
   * при каждом requestInputFocus; ChatInputArea фокусится при изменении.
   * Отдельный сигнал (вместо расширения focusChatId сентинелом), чтобы
   * не грязнить семантику существующего механизма фокуса по id чата.
   */
  focusInputToken: number;
  /**
   * Чат, который нужно переименовать сразу после создания (кнопка
   * «Новый чат»): ChatListItem сравнивает свой id с сигналом и
   * открывает popover в режиме rename. Одноразовый, переживает
   * рендер списка.
   */
  pendingRenameChatId: string | null;
  /**
   * Черновики в памяти (сессионное состояние, аналог sessionStorage):
   * переживают переключение чатов и вкладок, стираются при рестарте.
   */
  drafts: Record<string, string>;
  /** Черновик временного чата (когда активный чат не выбран) */
  globalDraft: string;
  /** Записи контекста активного чата (по возрастанию created_at) */
  activeNotes: NoteRecord[];
  /** Шаблон, привязанный к активному чату (null — временный чат или без шаблона) */
  activeTemplate: ApiTemplate | null;
  /** Шаблон, выбранный для временного чата до его создания */
  tempTemplateId: string | null;
  /**
   * Глобальный «последний используемый» шаблон: in-memory состояние
   * уровня UI (как drafts), при перезагрузке приложения сбрасывается.
   * Пишется при выборе в поповере, при отправке с шаблоном и при
   * создании шаблона. Временный чат всегда стартует с этим шаблоном.
   */
  lastTemplateId: string | null;
  /**
   * Счетчик загрузок контекста: применяется только результат последнего
   * вызова loadChat — более ранние загрузки не перетирают свежие данные.
   */
  loadChatToken: number;

  loadChats: () => Promise<void>;
  createChat: (title: string) => Promise<ChatRecord>;
  renameChat: (id: string, title: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  setPinned: (id: string, isPinned: boolean) => Promise<void>;
  setDraft: (id: string, draft: string) => void;
  setGlobalDraft: (draft: string) => void;
  setActiveChat: (id: string | null) => void;
  setSortDirection: (direction: SortDirection) => void;
  consumeFocusChat: (id: string) => void;
  requestInputFocus: () => void;
  consumePendingRename: (id: string) => void;
  /** Загружает notes и привязанный шаблон чата (для открытия старого чата) */
  loadChat: (chatId: string) => Promise<void>;
  /** Выбирает шаблон для существующего чата (стора + БД) */
  setChatTemplate: (chatId: string, templateId: string | null) => Promise<void>;
  /** Выбирает шаблон для временного чата (до его создания) */
  setTempTemplate: (templateId: string | null) => void;
  /** Пишет глобальный «последний используемый» шаблон (отправка, создание) */
  setLastTemplateId: (templateId: string) => void;
  /**
   * Инициализирует временный чат при первой отправке: пишет в БД,
   * делает активным, попадает в список. Без сигнала авто-rename.
   */
  initTempChat: (title: string, templateId: string | null) => Promise<ChatRecord>;
  /** Добавляет note в активный чат сразу в UI (уже записанную в БД) */
  appendLocalNote: (note: NoteRecord) => void;
  /** Сбрасывает загруженный контекст (при уходе во временный чат) */
  clearLoadedChat: () => void;
};
