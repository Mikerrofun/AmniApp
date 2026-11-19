/** Всего попыток withRetry: первая + два ретрая */
export const RETRY_ATTEMPTS = 3;

/** Фиксированная пауза между попытками, мс (без экспоненты и джиттера) */
export const RETRY_BACKOFF_MS = 400;
