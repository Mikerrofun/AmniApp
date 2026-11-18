/** Конфигурация получения списка моделей провайдера */

/** Таймаут запроса GET /models */
export const MODELS_REQUEST_TIMEOUT_MS = 10000;

/** Нативный endpoint списка моделей Gemini (не OpenAI-совместимый) */
export const GEMINI_MODELS_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

/** Нативный endpoint списка моделей Cohere (не OpenAI-совместимый) */
export const COHERE_MODELS_URL = "https://api.cohere.ai/v1/models";

/** Суффикс fallback-проверки совместимости endpoint */
export const CHAT_COMPLETIONS_PATH = "/chat/completions";

/**
 * Минимальное dummy-тело fallback-проверки: тело не валидируется,
 * но без model часть серверов отвечает 400 вместо 200
 */
export const CHAT_COMPLETIONS_PROBE_BODY = JSON.stringify({
  model: "probe",
  messages: [{ role: "user", content: "ping" }],
});
