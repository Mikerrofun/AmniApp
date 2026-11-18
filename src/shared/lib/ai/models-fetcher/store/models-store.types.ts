/** Статус загрузки списка моделей для одной пары baseUrl|apiKey */
export type ModelsStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Запись кэша моделей: in-memory на сессию, не персистится */
export type ModelsCacheEntry = {
  status: ModelsStatus;
  models: string[];
};

export type ModelsState = {
  /** Ключ записи — `baseUrl|apiKey` (см. modelsCacheKey) */
  entries: Record<string, ModelsCacheEntry>;
  /**
   * Обеспечивает список моделей: ready — из кэша без запроса,
   * loading — не запускает второй запрос (in-flight дедупликация),
   * иначе выполняет фетчер из MODELS_FETCHERS по provider.
   */
  ensureModels: (
    /** Provider id — выбор фетчера из MODELS_FETCHERS */
    provider: string,
    baseUrl: string,
    apiKey: string,
  ) => Promise<void>;
  /** Абортит in-flight запрос по ключу и удаляет запись кэша */
  cancelKey: (baseUrl: string, apiKey: string) => void;
  /**
   * Записывает готовый список моделей в кэш: probe коллизии или ручного
   * baseUrl уже получил модели — ensureModels увидит ready и не будет
   * дублировать запрос.
   */
  receiveModels: (baseUrl: string, apiKey: string, models: string[]) => void;
};
