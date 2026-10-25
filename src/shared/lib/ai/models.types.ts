/** Параметры запроса списка моделей провайдера */
export type FetchAvailableModelsParams = {
  baseUrl: string;
  apiKey: string;
  signal?: AbortSignal;
};

/** Элемент ответа провайдера GET /models (OpenAI-совместимый формат) */
export type ProviderModelItem = {
  id?: unknown;
};

/** Тело ответа провайдера GET /models */
export type ProviderModelsResponse = {
  data?: ProviderModelItem[];
};

/** Причина неудачи запроса списка моделей */
export type FetchModelsErrorReason = 'network' | 'unauthorized' | 'other';

/**
 * Результат запроса списка моделей: ошибки классифицируются здесь
 * и не выбрасываются наверх необработанными исключениями.
 */
export type FetchModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; reason: FetchModelsErrorReason };
