import { create } from 'zustand';

import type { GenerationState } from './generation-store.types';

/**
 * Состояние генерации ответа (slim-стор): оптимистичное сообщение юзера,
 * стриминг токен-за-токеном и временное сообщение об ошибке. В БД пишем
 * только после успешного стрима — ошибки и откаты живут здесь.
 */
export const useGenerationStore = create<GenerationState>((set) => ({
  status: 'idle',
  chatId: null,
  pendingUserText: null,
  streamingText: '',
  errorText: null,

  setPendingUser: (text) => set({ pendingUserText: text, errorText: null }),

  start: (chatId) =>
    set({ status: 'streaming', chatId, streamingText: '', errorText: null }),

  appendChunk: (accumulatedText) => set({ streamingText: accumulatedText }),

  fail: (message) =>
    set({ status: 'error', errorText: message, pendingUserText: null }),

  clearError: () =>
    set((state) =>
      state.status === 'error' ? { status: 'idle', errorText: null } : state,
    ),

  finish: () =>
    set({
      status: 'idle',
      chatId: null,
      pendingUserText: null,
      streamingText: '',
      errorText: null,
    }),

  reset: () =>
    set({
      status: 'idle',
      chatId: null,
      pendingUserText: null,
      streamingText: '',
      errorText: null,
    }),
}));
