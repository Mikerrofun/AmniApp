import { fetch } from 'expo/fetch';

import { MODELS_REQUEST_TIMEOUT_MS } from './models.config';
import type {
  FetchAvailableModelsParams,
  FetchModelsErrorReason,
  FetchModelsResult,
} from './models.types';
import { parseAnthropicModelList } from './parse-anthropic-models';
import { parseCohereModelList } from './parse-cohere-models';
import { parseGeminiModelList } from './parse-gemini-models';

/** Нативный endpoint списка моделей Gemini (не OpenAI-совместимый) */
const GEMINI_MODELS_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

/** Нативный endpoint списка моделей Cohere (не OpenAI-совместимый) */
const COHERE_MODELS_URL = 'https://api.cohere.ai/v1/models';

/**
 * Общая механика нативных запросов списка моделей: таймаут + внешний
 * abort, классификация ошибок в FetchModelsResult. Парсинг ответа —
 * у вызывающего фетчера.
 */
async function fetchProviderJson(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<
  { ok: true; payload: unknown } | { ok: false; reason: FetchModelsErrorReason }
> {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();

  signal?.addEventListener('abort', onExternalAbort);

  const timeout = setTimeout(
    () => controller.abort(),
    MODELS_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: 'unauthorized' };
    }

    if (!response.ok) {
      return { ok: false, reason: 'other' };
    }

    return { ok: true, payload: await response.json() };
  } catch (error) {
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

/**
 * Anthropic: нативный GET /models с `x-api-key` + `anthropic-version` —
 * не полагаемся на то, что compat-слой отдаёт /models в OpenAI-формате.
 */
export async function fetchAnthropicModels({
  baseUrl,
  apiKey,
  signal,
}: FetchAvailableModelsParams): Promise<FetchModelsResult> {
  const result = await fetchProviderJson(
    `${baseUrl}/models`,
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    signal,
  );

  if (!result.ok) return result;

  return { ok: true, models: parseAnthropicModelList(result.payload) };
}

/**
 * Gemini: нативный GET v1beta/models с ключом в query (`?key=`) —
 * compat-слой не гарантирует OpenAI-формат списка моделей.
 */
export async function fetchGeminiModels({
  apiKey,
  signal,
}: FetchAvailableModelsParams): Promise<FetchModelsResult> {
  const result = await fetchProviderJson(
    `${GEMINI_MODELS_URL}?key=${encodeURIComponent(apiKey)}`,
    {},
    signal,
  );

  if (!result.ok) return result;

  return { ok: true, models: parseGeminiModelList(result.payload) };
}

/** Cohere: нативный GET /v1/models (Bearer), формат `models[].name` */
export async function fetchCohereModels({
  apiKey,
  signal,
}: FetchAvailableModelsParams): Promise<FetchModelsResult> {
  const result = await fetchProviderJson(
    COHERE_MODELS_URL,
    { Authorization: `Bearer ${apiKey}` },
    signal,
  );

  if (!result.ok) return result;

  return { ok: true, models: parseCohereModelList(result.payload) };
}
