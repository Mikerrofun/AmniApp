import { create } from 'zustand';

import type { GenerationState } from './generation-store.types';

/**
 * Состояние генерации ответа (slim-стор): стриминг токен-за-токеном
 * и временное системное сообщение об ошибке. Ошибки в БД не пишутся.
 */
export const useGenerationStore = create<GenerationState>((set) => ({
  status: 'idle',
  chatId: null,
  streamingText: '',
  errorText: null,

  start: (chatId) =>
    set({ status: 'streaming', chatId, streamingText: '', errorText: null }),

  appendChunk: (accumulatedText) => set({ streamingText: accumulatedText }),

  fail: (message) => set({ status: 'error', errorText: message }),

  finish: () =>
    set({ status: 'idle', chatId: null, streamingText: '', errorText: null }),

  reset: () =>
    set({ status: 'idle', chatId: null, streamingText: '', errorText: null }),
}));
