/** Конфигурация автоопределения провайдера по префиксу API-ключа */

/** Задержка после остановки ввода ключа перед определением провайдера */
export const PROVIDER_DETECT_DEBOUNCE_MS = 1000;

/** Минимальная длина ключа для запуска определения (согласована с models.config) */
export const PROVIDER_DETECT_MIN_KEY_LENGTH = 20;

// Таймаут probe-запроса отдельно не конфигурируется: probe выполняется
// через fetchAvailableModels, таймаут MODELS_REQUEST_TIMEOUT_MS встроен в него
