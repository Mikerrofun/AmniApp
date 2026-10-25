/** Конфигурация получения списка моделей провайдера */

/** Таймаут запроса GET /models */
export const MODELS_REQUEST_TIMEOUT_MS = 15000;

/** Минимальная длина ключа, с которой разрешен авто-запрос списка моделей */
export const MODELS_MIN_API_KEY_LENGTH = 20;

/** Задержка после остановки ввода ключа перед авто-запросом списка */
export const MODELS_FETCH_DEBOUNCE_MS = 700;
