import { fetch } from 'expo/fetch';

import { normalizeModelList } from './normalize-models';
import { MODELS_REQUEST_TIMEOUT_MS } from './models.config';
import type {
  FetchAvailableModelsParams,
  FetchModelsResult,
} from './models.types';

/**
 * Получает список моделей провайдера: нативный fetch с устройства
 * `GET {baseUrl}/models` с `Authorization: Bearer` (тот же паттерн,
 * что openai-compat-client — без бекенда, ключ никуда не логируется).
 * Ошибки классифицируются в результат, а не выбрасываются наверх.
 */
export async function fetchAvailableModels({
  baseUrl,
  apiKey,
  signal,
}: FetchAvailableModelsParams): Promise<FetchModelsResult> {
  // Совмещаем внешний сигнал с таймаутом: один контроллер на оба случая
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();

  signal?.addEventListener('abort', onExternalAbort);

  const timeout = setTimeout(
    () => controller.abort(),
    MODELS_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: 'unauthorized' };
    }

    if (!response.ok) {
      return { ok: false, reason: 'other' };
    }

    const payload = await response.json();

    return { ok: true, models: normalizeModelList(payload) };
  } catch (error) {
    // Аборт (внешний или по таймауту) — не сетевая ошибка
    if (controller.signal.aborted) {
      return { ok: false, reason: 'other' };
    }

    return {
      ok: false,
      reason: error instanceof TypeError ? 'network' : 'other',
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
