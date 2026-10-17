import { create } from 'zustand';

import * as chatsRepository from '@/lib/db';

import type { ChatsState } from './chats-store.types';

/**
 * Состояние чатов. Экшены вызывают репозиторий и обновляют стейт.
 * Загрузка выполняется при монтировании чат-экрана (useChats).
 */
export const useChatsStore = create<ChatsState>((set) => ({
  chats: [],
  activeChatId: null,
  sortDirection: 'newest',
  isLoading: false,
  focusChatId: null,
  focusInputToken: 0,
  pendingRenameChatId: null,
  drafts: {},
  globalDraft: '',
  activeNotes: [],
  activeTemplate: null,
  tempTemplateId: null,
  loadChatToken: 0,

  loadChats: async () => {
    set({ isLoading: true });

    try {
      const chats = await chatsRepository.listChats();
      set({ chats, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createChat: async (title) => {
    const chat = await chatsRepository.createChat(title);

    set((state) => ({
      chats: [chat, ...state.chats],
      activeChatId: chat.id,
      focusChatId: chat.id,
      // Сигнал авто-rename: новый чат сразу открывается в режиме rename
      pendingRenameChatId: chat.id,
      // Черновик временного чата переезжать в новый чат не должен:
      // временный чат после создания реального недоступен
      globalDraft: '',
    }));

    return chat;
  },

  renameChat: async (id, title) => {
    await chatsRepository.renameChat(id, title);

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === id ? { ...chat, title } : chat,
      ),
    }));
  },

  deleteChat: async (id) => {
    await chatsRepository.deleteChat(id);

    set((state) => {
      const drafts = { ...state.drafts };
      delete drafts[id];

      const isActiveDeleted = state.activeChatId === id;

      return {
        chats: state.chats.filter((chat) => chat.id !== id),
        drafts,
        activeChatId: isActiveDeleted ? null : state.activeChatId,
        // Загруженный контекст удаленного чата больше не актуален
        activeNotes: isActiveDeleted ? [] : state.activeNotes,
        activeTemplate: isActiveDeleted ? null : state.activeTemplate,
        // Гигиена: не оставлять сигнал авто-rename на удаленный чат
        pendingRenameChatId:
          state.pendingRenameChatId === id
            ? null
            : state.pendingRenameChatId,
      };
    });
  },

  setPinned: async (id, isPinned) => {
    // Оптимистичное обновление: гвоздик реагирует мгновенно
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === id ? { ...chat, isPinned } : chat,
      ),
    }));

    try {
      await chatsRepository.setPinned(id, isPinned);
    } catch {
      // Откат при ошибке записи
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === id ? { ...chat, isPinned: !isPinned } : chat,
        ),
      }));
    }
  },

  setDraft: (id, draft) =>
    set((state) => ({ drafts: { ...state.drafts, [id]: draft } })),

  setGlobalDraft: (draft) => set({ globalDraft: draft }),

  setActiveChat: (id) => set({ activeChatId: id }),

  setSortDirection: (direction) => set({ sortDirection: direction }),

  consumeFocusChat: (id) =>
    set((state) => (state.focusChatId === id ? { focusChatId: null } : state)),

  requestInputFocus: () =>
    set((state) => ({ focusInputToken: state.focusInputToken + 1 })),

  consumePendingRename: (id) =>
    set((state) =>
      state.pendingRenameChatId === id ? { pendingRenameChatId: null } : state,
    ),

  loadChat: async (chatId) => {
    // Токен: применяется только результат последнего вызова — более
    // ранняя загрузка не перетрет notes, дописанные после нее
    const token = useChatsStore.getState().loadChatToken + 1;
    set({ loadChatToken: token });

    try {
      const [notes, template] = await Promise.all([
        chatsRepository.getNotes(chatId),
        chatsRepository.getTemplateForChat(chatId),
      ]);

      set((state) =>
        state.activeChatId === chatId && state.loadChatToken === token
          ? { activeNotes: notes, activeTemplate: template }
          : state,
      );
    } catch {
      // Контекст недоступен — чат открывается без истории
    }
  },

  setChatTemplate: async (chatId, templateId) => {
    const template = templateId
      ? await chatsRepository.getTemplate(templateId)
      : null;

    await chatsRepository.setChatTemplate(chatId, templateId);

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, templateId } : chat,
      ),
      activeTemplate:
        state.activeChatId === chatId ? template : state.activeTemplate,
    }));
  },

  setTempTemplate: (templateId) => set({ tempTemplateId: templateId }),

  initTempChat: async (title, templateId) => {
    const template = templateId
      ? await chatsRepository.getTemplate(templateId)
      : null;
    const chat = await chatsRepository.createChat(title, templateId);

    set((state) => ({
      chats: [chat, ...state.chats],
      activeChatId: chat.id,
      activeNotes: [],
      activeTemplate: template,
      // Выбор шаблона «переехал» в чат — временный выбор больше не нужен
      tempTemplateId: null,
      // Черновик временного чата переезжать в новый чат не должен
      globalDraft: '',
    }));

    return chat;
  },

  appendLocalNote: (note) =>
    set((state) => ({ activeNotes: [...state.activeNotes, note] })),

  clearLoadedChat: () =>
    set({ activeNotes: [], activeTemplate: null, tempTemplateId: null }),
}));
