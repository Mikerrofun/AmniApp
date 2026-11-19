import { fetch } from "expo/fetch";

import {
  RetryableError,
  isRetryableStatus,
  withRetry,
} from "../../../net";
import { parseAnthropicModelList } from "../parsers/parse-anthropic-models";
import { parseCohereModelList } from "../parsers/parse-cohere-models";
import { parseGeminiModelList } from "../parsers/parse-gemini-models";
import { parseOpenaiModelList } from "../parsers/parse-openai-models";
import {
  CHAT_COMPLETIONS_PATH,
  CHAT_COMPLETIONS_PROBE_BODY,
  COHERE_MODELS_URL,
  GEMINI_MODELS_URL,
  MODELS_REQUEST_TIMEOUT_MS,
} from "./models-fetcher.config";
import type {
  FetchAvailableModelsParams,
  FetchModelsErrorReason,
  FetchModelsResult,
  ModelsFetcher,
  ProbeChatCompletionsResult,
} from "./models-fetcher.types";

/** Минимальный набор опций нативного fetch, используемый фетчерами */
type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

/**
 * Одна попытка запроса с таймаутом: внутренний контроллер абортится по
 * таймауту ИЛИ по внешнему signal. Ошибки (сеть/таймаут/внешний abort)
 * пробрасываются наверх — классификация остается снаружи, в фетчере.
 * Таймаут-контроллер создается на каждую попытку: таймаут одной попытки
 * ретраится, внешний abort — нет (withRetry проверяет внешний signal).
 */
async function fetchWithTimeout(
  url: string,
  init: FetchInit,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();

  signal?.addEventListener("abort", onExternalAbort);

  const timeout = setTimeout(
    () => controller.abort(),
    MODELS_REQUEST_TIMEOUT_MS,
  );

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

/** 5xx/429/408 — ретраебельный сбой: бросаем, чтобы withRetry сделал ретрай */
function throwIfRetryableStatus(status: number): void {
  if (isRetryableStatus(status)) {
    throw new RetryableError(`HTTP ${status}`, status);
  }
}

/** Классификация ошибки попытки в FetchModelsResult (как раньше, снаружи ретрая) */
function classifyFetchError(
  error: unknown,
  signal?: AbortSignal,
): { ok: false; reason: FetchModelsErrorReason } {
  if (signal?.aborted) return { ok: false, reason: "other" };

  return {
    ok: false,
    reason: error instanceof TypeError ? "network" : "other",
  };
}

/**
 * Общая механика нативных запросов списка моделей: ретрай (сеть/таймаут
 * попытки/5xx/429) + классификация ошибок в FetchModelsResult. Парсинг
 * ответа — у вызывающего фетчера.
 */
async function fetchProviderJson(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<
  { ok: true; payload: unknown } | { ok: false; reason: FetchModelsErrorReason }
> {
  try {
    const response = await withRetry(async () => {
      const attempt = await fetchWithTimeout(url, { headers }, signal);

      throwIfRetryableStatus(attempt.status);

      return attempt;
    }, { signal });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthorized" };
    }

    if (!response.ok) {
      return { ok: false, reason: "other" };
    }

    return { ok: true, payload: await response.json() };
  } catch (error) {
    return classifyFetchError(error, signal);
  }
}

/**
 * Дефолтный (OpenAI-совместимый) фетчер: нативный fetch с устройства
 * `GET {baseUrl}/models` с `Authorization: Bearer` (тот же паттерн,
 * что openai-compat-client — без бекенда, ключ никуда не логируется).
 * Ошибки классифицируются в результат, а не выбрасываются наверх.
 */
export async function fetchAvailableModels({
  baseUrl,
  apiKey,
  signal,
}: FetchAvailableModelsParams): Promise<FetchModelsResult> {
  try {
    const response = await withRetry(async () => {
      const attempt = await fetchWithTimeout(
        `${baseUrl}/models`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
        signal,
      );

      throwIfRetryableStatus(attempt.status);

      return attempt;
    }, { signal });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthorized" };
    }

    if (!response.ok) {
      return { ok: false, reason: "other" };
    }

    const payload = await response.json();

    return { ok: true, models: parseOpenaiModelList(payload) };
  } catch (error) {
    return classifyFetchError(error, signal);
  }
}

/**
 * Fallback-проверка совместимости endpoint без GET /models: POST
 * `{baseUrl}/chat/completions`, успех — строго HTTP 200 (тело не
 * валидируем). Классификация ошибок повторяет fetchAvailableModels.
 */
export async function probeChatCompletions({
  baseUrl,
  apiKey,
  signal,
}: FetchAvailableModelsParams): Promise<ProbeChatCompletionsResult> {
  try {
    const response = await withRetry(async () => {
      const attempt = await fetchWithTimeout(
        `${baseUrl}${CHAT_COMPLETIONS_PATH}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: CHAT_COMPLETIONS_PROBE_BODY,
        },
        signal,
      );

      throwIfRetryableStatus(attempt.status);

      return attempt;
    }, { signal });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthorized" };
    }

    return response.status === 200
      ? { ok: true }
      : { ok: false, reason: "other" };
  } catch (error) {
    return classifyFetchError(error, signal);
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
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
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

/** Нативные фетчеры провайдеров с не-OpenAI-совместимым списком моделей */
export const MODELS_FETCHERS: Record<string, ModelsFetcher> = {
  anthropic: fetchAnthropicModels,
  gemini: fetchGeminiModels,
  cohere: fetchCohereModels,
};

/** Фетчер по provider id; неизвестный id — дефолтный OpenAI-фетчер */
export const getModelsFetcher = (providerId: string): ModelsFetcher =>
  MODELS_FETCHERS[providerId] ?? fetchAvailableModels;
