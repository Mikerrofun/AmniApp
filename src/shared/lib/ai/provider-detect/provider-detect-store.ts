import { create } from 'zustand';

import { getModelsFetcher, useModelsStore } from '../models-fetcher';
import { resolveProvider } from './provider-detect';
import type { ProviderDetectState } from './provider-detect-store.types';

// Контроллеры in-flight probe — несериализуемое состояние вне стора
const inFlightControllers = new Map<string, AbortController>();

/**
 * Кэш результатов детекта провайдера по API-ключу. In-memory на сессию:
 * рестарт приложения сбрасывает кэш, детект выполняется заново.
 */
export const useProviderDetectStore = create<ProviderDetectState>(
  (set, get) => ({
    entries: {},

    ensureDetect: async (apiKey, signal) => {
      // Запись существует только в небазовых статусах — кэш на сессию
      if (get().entries[apiKey]) return;

      const controller = new AbortController();
      const onExternalAbort = () => controller.abort();

      signal?.addEventListener('abort', onExternalAbort);
      inFlightControllers.set(apiKey, controller);

      set((state) => ({
        entries: { ...state.entries, [apiKey]: { status: 'detecting' } },
      }));

      const result = await resolveProvider(
        apiKey,
        (providerId) => getModelsFetcher(providerId),
        controller.signal,
      );

      // Ключ сбросили/заменили, пока probe был в полете, — ответ от
      // старого ключа не должен перезаписать состояние новой записи
      if (inFlightControllers.get(apiKey) !== controller) {
        signal?.removeEventListener('abort', onExternalAbort);
        return;
      }

      inFlightControllers.delete(apiKey);
      signal?.removeEventListener('abort', onExternalAbort);

      set((state) => ({
        entries: {
          ...state.entries,
          [apiKey]:
            result.status === 'resolved'
              ? {
                  status: 'resolved',
                  providerId: result.providerId,
                  baseUrl: result.baseUrl,
                }
              : { status: result.status },
        },
      }));

      // Модели победителя коллизии уже получены probe — пишем их в
      // models-store, чтобы ensureModels не дублировал запрос. В entry
      // детекта models не хранятся: единственный кэш списков — models-store
      if (result.status === 'resolved' && result.models.length > 0) {
        useModelsStore
          .getState()
          .receiveModels(result.baseUrl, apiKey, result.models);
      }
    },

    cancelKey: (apiKey) => {
      inFlightControllers.get(apiKey)?.abort();
      inFlightControllers.delete(apiKey);

      set((state) => {
        if (!state.entries[apiKey]) return state;

        const entries = { ...state.entries };
        delete entries[apiKey];

        return { entries };
      });
    },
  }),
);
