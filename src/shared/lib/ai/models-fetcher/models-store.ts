import { create } from "zustand";

import { getModelsFetcher } from "./models-fetcher";
import type { ModelsState } from "./models-store.types";

export const modelsCacheKey = (baseUrl: string, apiKey: string): string =>
  `${baseUrl}|${apiKey}`;

// Контроллеры in-flight запросов — несериализуемое состояние вне стора
const inFlightControllers = new Map<string, AbortController>();

/**
 * Кэш списков моделей провайдеров. In-memory на сессию: рестарт
 * приложения сбрасывает кэш, список запрашивается заново. Два шаблона
 * с одинаковыми baseUrl+ключ шарят один запрос списка моделей.
 */
export const useModelsStore = create<ModelsState>((set, get) => ({
  entries: {},

  ensureModels: async (provider, baseUrl, apiKey) => {
    const key = modelsCacheKey(baseUrl, apiKey);
    const entry = get().entries[key];

    if (entry?.status === "ready" || entry?.status === "loading") return;

    const controller = new AbortController();
    inFlightControllers.set(key, controller);

    set((state) => ({
      entries: { ...state.entries, [key]: { status: "loading", models: [] } },
    }));

    // Provider выбирает фетчер из MODELS_FETCHERS (нативные списки
    // anthropic/gemini/cohere, для остальных — OpenAI-запрос)
    const fetchModels = getModelsFetcher(provider);
    const result = await fetchModels({ baseUrl, apiKey, signal: controller.signal });

    // Ключ сбросили/заменили, пока запрос был в полете, — ответ
    // от старого ключа не должен перезаписать состояние новой записи
    if (inFlightControllers.get(key) !== controller) return;

    inFlightControllers.delete(key);

    set((state) => ({
      entries: {
        ...state.entries,
        [key]: result.ok
          ? { status: "ready", models: result.models }
          : { status: "error", models: [] },
      },
    }));
  },

  cancelKey: (baseUrl, apiKey) => {
    const key = modelsCacheKey(baseUrl, apiKey);

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
