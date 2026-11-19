import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RETRY_ATTEMPTS,
  RETRY_BACKOFF_MS,
  RetryableError,
  isRetryableError,
  isRetryableStatus,
  withRetry,
} from '../../src/shared/lib/net';

const networkError = () => new TypeError('Network request failed');

const abortError = () => {
  const error = new Error('Aborted');
  error.name = 'AbortError';

  return error;
};

const statusError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { status });

describe('isRetryableStatus', () => {
  it('ретраебельные статусы: 408, 429, 5xx', () => {
    assert.equal(isRetryableStatus(408), true);
    assert.equal(isRetryableStatus(429), true);
    assert.equal(isRetryableStatus(500), true);
    assert.equal(isRetryableStatus(502), true);
    assert.equal(isRetryableStatus(599), true);
  });

  it('не ретраебельные: 4xx (кроме 408/429) и вне диапазонов', () => {
    assert.equal(isRetryableStatus(400), false);
    assert.equal(isRetryableStatus(401), false);
    assert.equal(isRetryableStatus(403), false);
    assert.equal(isRetryableStatus(404), false);
    assert.equal(isRetryableStatus(422), false);
    assert.equal(isRetryableStatus(499), false);
    assert.equal(isRetryableStatus(600), false);
  });
});

describe('isRetryableError', () => {
  it('сеть (TypeError) — ретраебельна', () => {
    assert.equal(isRetryableError(networkError()), true);
  });

  it('таймаут попытки (AbortError) — ретраебельна', () => {
    assert.equal(isRetryableError(abortError()), true);
  });

  it('5xx/429/408 — ретраебельны', () => {
    assert.equal(isRetryableError(statusError(502)), true);
    assert.equal(isRetryableError(statusError(429)), true);
    assert.equal(isRetryableError(statusError(408)), true);
  });

  it('другие 4xx — fail-fast', () => {
    assert.equal(isRetryableError(statusError(400)), false);
    assert.equal(isRetryableError(statusError(401)), false);
    assert.equal(isRetryableError(statusError(404)), false);
  });

  it('RetryableError классифицируется по статусу', () => {
    assert.equal(isRetryableError(new RetryableError('boom', 503)), true);
    assert.equal(isRetryableError(new RetryableError('boom', 400)), false);
  });

  it('прочие ошибки — не ретраебельны', () => {
    assert.equal(isRetryableError(new Error('parse failed')), false);
  });
});

describe('withRetry', () => {
  it('успех с первой попытки — один вызов', async () => {
    let calls = 0;

    const result = await withRetry(async () => {
      calls += 1;

      return 'ok';
    });

    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  it('ретрай на сетевой ошибке: сбой, затем успех — 2 вызова', async () => {
    let calls = 0;

    const result = await withRetry(async () => {
      calls += 1;

      if (calls === 1) throw networkError();

      return 'ok';
    });

    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('исчерпание попыток: бросается последняя ошибка, вызовов = RETRY_ATTEMPTS', async () => {
    let calls = 0;

    await assert.rejects(
      withRetry(async () => {
        calls += 1;
        throw networkError();
      }),
      TypeError,
    );

    assert.equal(calls, RETRY_ATTEMPTS);
    assert.equal(RETRY_ATTEMPTS, 2);
  });

  it('ретрай на 5xx и 429', async () => {
    for (const status of [500, 502, 429]) {
      let calls = 0;

      await withRetry(async () => {
        calls += 1;

        if (calls === 1) throw statusError(status);

        return 'ok';
      });

      assert.equal(calls, 2, `status ${status}`);
    }
  });

  it('fail-fast на 4xx: один вызов, без задержки', async () => {
    let calls = 0;

    await assert.rejects(
      withRetry(async () => {
        calls += 1;
        throw statusError(401);
      }),
      (error: Error) => (error as { status?: number }).status === 401,
    );

    assert.equal(calls, 1);
  });

  it('таймаут попытки (AbortError без внешнего abort) ретраится', async () => {
    let calls = 0;

    const result = await withRetry(async () => {
      calls += 1;

      if (calls === 1) throw abortError();

      return 'ok';
    });

    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('внешний abort до старта — fn не вызывается', async () => {
    const controller = new AbortController();
    controller.abort();

    let calls = 0;

    await assert.rejects(
      withRetry(
        async () => {
          calls += 1;

          return 'ok';
        },
        { signal: controller.signal },
      ),
    );

    assert.equal(calls, 0);
  });

  it('внешний abort во время попытки — без ретрая', async () => {
    const controller = new AbortController();
    let calls = 0;

    await assert.rejects(
      withRetry(async () => {
        calls += 1;
        controller.abort();
        throw abortError();
      }, { signal: controller.signal }),
    );

    assert.equal(calls, 1);
  });

  it('внешний abort во время backoff — второй попытки нет', async () => {
    const controller = new AbortController();
    let calls = 0;

    setTimeout(() => controller.abort(), 10);

    await assert.rejects(
      withRetry(async () => {
        calls += 1;
        throw networkError();
      }, { signal: controller.signal, backoffMs: 500 }),
    );

    assert.equal(calls, 1);
  });

  it('backoff соблюдается между попытками', async () => {
    let calls = 0;
    const backoffMs = 50;
    const startedAt = Date.now();

    await withRetry(async () => {
      calls += 1;

      if (calls === 1) throw networkError();

      return 'ok';
    }, { backoffMs });

    assert.equal(calls, 2);
    assert.ok(Date.now() - startedAt >= backoffMs);
  });

  it('кастомный shouldRetry может запретить ретрай ретраебельной ошибки', async () => {
    let calls = 0;

    await assert.rejects(
      withRetry(async () => {
        calls += 1;
        throw networkError();
      }, { shouldRetry: () => false }),
    );

    assert.equal(calls, 1);
  });

  it('кастомный attempts увеличивает число попыток', async () => {
    let calls = 0;

    await assert.rejects(
      withRetry(async () => {
        calls += 1;
        throw networkError();
      }, { attempts: 3, backoffMs: 1 }),
    );

    assert.equal(calls, 3);
  });

  it('дефолтный backoff — 400 мс', () => {
    assert.equal(RETRY_BACKOFF_MS, 400);
  });

  it('fn получает номер попытки (1-based)', async () => {
    const attempts: number[] = [];

    await withRetry(async (attempt) => {
      attempts.push(attempt);

      if (attempt < 2) throw networkError();

      return 'ok';
    }, { backoffMs: 1 });

    assert.deepEqual(attempts, [1, 2]);
  });
});
