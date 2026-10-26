/** Статус загрузки списка моделей для одной пары provider|apiKey */
export type ModelsStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Запись кэша моделей: in-memory на сессию, не персистится */
export type ModelsCacheEntry = {
  status: ModelsStatus;
  models: string[];
};

export type ModelsState = {
  /** Ключ записи — `provider|apiKey` (см. modelsCacheKey) */
  entries: Record<string, ModelsCacheEntry>;
  /**
   * Обеспечивает список моделей: ready — из кэша без запроса,
   * loading — не запускает второй запрос (in-flight дедупликация),
   * иначе выполняет fetchAvailableModels.
   */
  ensureModels: (
    provider: string,
    baseUrl: string,
    apiKey: string,
  ) => Promise<void>;
  /** Абортит in-flight запрос по ключу и удаляет запись кэша */
  cancelKey: (provider: string, apiKey: string) => void;
};
