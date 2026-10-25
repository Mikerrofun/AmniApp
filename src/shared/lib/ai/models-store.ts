import { create } from 'zustand';

import { fetchAvailableModels } from './models';
import type { ModelsState } from './models-store.types';

/** Ключ записи кэша: провайдер входит в ключ, у разных провайдеров списки разные */
export const modelsCacheKey = (provider: string, apiKey: string): string =>
  `${provider}|${apiKey}`;

// Контроллеры in-flight запросов — несериализуемое состояние вне стора
const inFlightControllers = new Map<string, AbortController>();

/**
 * Кэш списков моделей провайдеров. In-memory на сессию: рестарт
 * приложения сбрасывает кэш, список запрашивается заново.
 */
export const useModelsStore = create<ModelsState>((set, get) => ({
  entries: {},

  ensureModels: async (provider, baseUrl, apiKey) => {
    const key = modelsCacheKey(provider, apiKey);
    const entry = get().entries[key];

    if (entry?.status === 'ready' || entry?.status === 'loading') return;

    const controller = new AbortController();
    inFlightControllers.set(key, controller);

    set((state) => ({
      entries: { ...state.entries, [key]: { status: 'loading', models: [] } },
    }));

    const result = await fetchAvailableModels({
      baseUrl,
      apiKey,
      signal: controller.signal,
    });

    // Ключ сбросили/заменили, пока запрос был в полете, — ответ
    // от старого ключа не должен перезаписать состояние новой записи
    if (inFlightControllers.get(key) !== controller) return;

    inFlightControllers.delete(key);

    set((state) => ({
      entries: {
        ...state.entries,
        [key]: result.ok
          ? { status: 'ready', models: result.models }
          : { status: 'error', models: [] },
      },
    }));
  },

  cancelKey: (provider, apiKey) => {
    const key = modelsCacheKey(provider, apiKey);

    inFlightControllers.get(key)?.abort();
    inFlightControllers.delete(key);

    set((state) => {
      if (!state.entries[key]) return state;

      const entries = { ...state.entries };
      delete entries[key];

      return { entries };
    });
  },
}));
