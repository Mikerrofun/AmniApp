/** Всего попыток withRetry: первая + один ретрай */
export const RETRY_ATTEMPTS = 2;

/** Фиксированная пауза между попытками, мс (без экспоненты и джиттера) */
export const RETRY_BACKOFF_MS = 400;
