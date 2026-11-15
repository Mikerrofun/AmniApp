/** Конфигурация получения списка моделей провайдера */

/** Таймаут запроса GET /models */
export const MODELS_REQUEST_TIMEOUT_MS = 15000;

/** Задержка после остановки ввода ключа перед авто-запросом списка */
export const MODELS_FETCH_DEBOUNCE_MS = 1000;

/** Нативный endpoint списка моделей Gemini (не OpenAI-совместимый) */
export const GEMINI_MODELS_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

/** Нативный endpoint списка моделей Cohere (не OpenAI-совместимый) */
export const COHERE_MODELS_URL = "https://api.cohere.ai/v1/models";
