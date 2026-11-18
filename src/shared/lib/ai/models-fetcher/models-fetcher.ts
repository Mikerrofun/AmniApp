import { fetch } from "expo/fetch";

import { parseAnthropicModelList } from "./parsers/parse-anthropic-models";
import { parseCohereModelList } from "./parsers/parse-cohere-models";
import { parseGeminiModelList } from "./parsers/parse-gemini-models";
import { parseOpenaiModelList } from "./parsers/parse-openai-models";
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

  signal?.addEventListener("abort", onExternalAbort);

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
      return { ok: false, reason: "unauthorized" };
    }

    if (!response.ok) {
      return { ok: false, reason: "other" };
    }

    return { ok: true, payload: await response.json() };
  } catch (error) {
    if (controller.signal.aborted) {
      return { ok: false, reason: "other" };
    }

    return {
      ok: false,
      reason: error instanceof TypeError ? "network" : "other",
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
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
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();

  signal?.addEventListener("abort", onExternalAbort);

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
      return { ok: false, reason: "unauthorized" };
    }

    if (!response.ok) {
      return { ok: false, reason: "other" };
    }

    const payload = await response.json();

    return { ok: true, models: parseOpenaiModelList(payload) };
  } catch (error) {
    if (controller.signal.aborted) {
      return { ok: false, reason: "other" };
    }

    return {
      ok: false,
      reason: error instanceof TypeError ? "network" : "other",
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
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
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();

  signal?.addEventListener("abort", onExternalAbort);

  const timeout = setTimeout(
    () => controller.abort(),
    MODELS_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${baseUrl}${CHAT_COMPLETIONS_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: CHAT_COMPLETIONS_PROBE_BODY,
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "unauthorized" };
    }

    return response.status === 200
      ? { ok: true }
      : { ok: false, reason: "other" };
  } catch (error) {
    if (controller.signal.aborted) {
      return { ok: false, reason: "other" };
    }

    return {
      ok: false,
      reason: error instanceof TypeError ? "network" : "other",
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
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
