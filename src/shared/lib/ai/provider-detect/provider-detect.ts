import { PROVIDER_REGISTRY } from '@/shared/config/providers.config';

import type { ApiProviderConfig } from '@/shared/config/config.types';
import { PROVIDER_DETECT_MIN_KEY_LENGTH } from './provider-detect.config';
import type { ProviderDetectResult } from './provider-detect.types';
import type { ModelsFetcher } from '../models-fetcher';

/** Длина самого длинного префикса провайдера, совпавшего с ключом */
const matchedPrefixLength = (provider: ApiProviderConfig, key: string): number =>
  provider.prefixes.reduce(
    (max, prefix) =>
      key.startsWith(prefix.toLowerCase())
        ? Math.max(max, prefix.length)
        : max,
    0,
  );

/**
 * Сопоставляет ключ с префиксами реестра: longest-prefix match, регистр
 * не важен. Выигрывает самый длинный сработавший префикс (`sk-or-v1-`
 * бьется раньше `sk-`, `sk-ant-` раньше `sk-`); кандидаты равной длины
 * остаются все — 0, 1 или несколько id (коллизия `sk-` у OpenAI и DeepSeek).
 */
export function matchProviders(apiKey: string): ApiProviderConfig[] {
  const key = apiKey.trim().toLowerCase();

  const matched = PROVIDER_REGISTRY.filter(
    (provider) => matchedPrefixLength(provider, key) > 0,
  );

  if (matched.length <= 1) return matched;

  const maxLength = Math.max(
    ...matched.map((provider) => matchedPrefixLength(provider, key)),
  );

  return matched.filter(
    (provider) => matchedPrefixLength(provider, key) === maxLength,
  );
}

/**
 * Определяет провайдера по ключу. Один кандидат — resolved без запроса;
 * коллизия префиксов — параллельный probe `GET {baseUrl}/models` каждому
 * кандидату его собственным фетчером из резолвера (нативные списки
 * anthropic/gemini/cohere): побеждает первый успешный, его models идут
 * в результат. Отправка ключа нескольким серверам параллельно —
 * осознанный privacy-трейд-офф. Все probe неуспешны — failed.
 * Резолвер фетчеров передается параметром, чтобы логика тестировалась
 * без expo/fetch.
 */
export async function resolveProvider(
  apiKey: string,
  resolveFetcher: (providerId: string) => ModelsFetcher,
  signal?: AbortSignal,
): Promise<ProviderDetectResult> {
  if (apiKey.trim().length < PROVIDER_DETECT_MIN_KEY_LENGTH) {
    return { status: 'unknown' };
  }

  const candidates = matchProviders(apiKey);

  if (candidates.length === 0) return { status: 'unknown' };

  if (candidates.length === 1) {
    const [candidate] = candidates;

    return {
      status: 'resolved',
      providerId: candidate.id,
      baseUrl: candidate.baseUrl,
      models: [],
    };
  }

  const probes = candidates.map(async (candidate) => {
    const result = await resolveFetcher(candidate.id)({
      baseUrl: candidate.baseUrl,
      apiKey,
      signal,
    });

    if (!result.ok) throw new Error(`probe failed: ${result.reason}`);

    return { candidate, models: result.models };
  });

  const winner = await firstFulfilled(probes);

  if (!winner) return { status: 'failed' };

  return {
    status: 'resolved',
    providerId: winner.candidate.id,
    baseUrl: winner.candidate.baseUrl,
    models: winner.models,
  };
}

/**
 * Первый fulfilled промис побеждает, все rejected — null. Аналог
 * Promise.any без Promise.any: Hermes его не гарантирует.
 */
function firstFulfilled<T>(promises: Promise<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    let pending = promises.length;

    if (pending === 0) {
      resolve(null);
      return;
    }

    for (const promise of promises) {
      promise.then(resolve, () => {
        pending -= 1;

        if (pending === 0) resolve(null);
      });
    }
  });
}
