import { RETRY_ATTEMPTS, RETRY_BACKOFF_MS } from './with-retry.config';
import type { WithRetryOptions } from './with-retry.types';

/** Ретраебельные HTTP-статусы: таймаут шлюза, rate limit, ошибки сервера */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function getStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined;

  const status = (error as { status?: unknown }).status;

  return typeof status === 'number' ? status : undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function createAbortError(): Error {
  const error = new Error('Operation aborted');
  error.name = 'AbortError';

  return error;
}

/**
 * Дефолтный фильтр ретрая: сеть (fetch reject / TypeError), таймаут попытки
 * (abort внутри попытки — внешний abort проверяется в withRetry отдельно)
 * и статусы 408/429/5xx. Любой другой 4xx — наверх сразу, без ретрая.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (isAbortError(error)) return true;

  const status = getStatus(error);

  return status !== undefined && isRetryableStatus(status);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;

  throw signal.reason ?? createAbortError();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? createAbortError());
    };

    signal?.addEventListener('abort', onAbort);
  });
}

/**
 * Общий ретрай для сетевых запросов: вызывает fn(attempt); при ретраебельной
 * ошибке и неисчерпанных попытках ждет backoffMs и повторяет, иначе бросает
 * последнюю ошибку. Внешний signal aborted — бросает немедленно, без ретрая
 * и без backoff (проверяется и перед попыткой, и после ошибки, и во время сна).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? RETRY_ATTEMPTS;
  const backoffMs = options.backoffMs ?? RETRY_BACKOFF_MS;
  const shouldRetry = options.shouldRetry ?? isRetryableError;

  throwIfAborted(options.signal);

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      // Внешняя отмена — не сбой: наверх немедленно, без ретрая и без backoff
      if (options.signal?.aborted) throw error;

      if (attempt >= attempts || !shouldRetry(error)) throw error;

      await sleep(backoffMs, options.signal);
    }
  }
}
