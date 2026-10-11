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

    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== id),
      activeChatId:
        state.activeChatId === id ? null : state.activeChatId,
    }));
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

  updateDraft: async (id, draft) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === id ? { ...chat, draft } : chat,
      ),
    }));

    await chatsRepository.updateDraft(id, draft);
  },

  setActiveChat: (id) => set({ activeChatId: id }),

  setSortDirection: (direction) => set({ sortDirection: direction }),

  consumeFocusChat: (id) =>
    set((state) => (state.focusChatId === id ? { focusChatId: null } : state)),
}));
