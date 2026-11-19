/** Опции withRetry */
export type WithRetryOptions = {
  /** Всего попыток, включая первую. По умолчанию RETRY_ATTEMPTS */
  attempts?: number;
  /** Фиксированная пауза между попытками, мс. По умолчанию RETRY_BACKOFF_MS */
  backoffMs?: number;
  /**
   * Внешний сигнал отмены (юзер/размонтирование): abort — немедленный
   * выход без ретрая и без backoff. В отличие от таймаут-аборта попытки.
   */
  signal?: AbortSignal;
  /** Фильтр ошибок, подлежащих ретраю. По умолчанию isRetryableError */
  shouldRetry?: (error: unknown) => boolean;
};

/**
 * Ошибка HTTP-ответа, который можно классифицировать для ретрая по статусу:
 * ретраится только если статус попадает под isRetryableStatus (408/429/5xx).
 * 4xx-статус в ней означает fail-fast, как у любой другой 4xx-ошибки.
 */
export class RetryableError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RetryableError';
    this.status = status;
  }
}
