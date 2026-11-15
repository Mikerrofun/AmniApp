import { fetchAvailableModels } from "./models";
import {
  fetchAnthropicModels,
  fetchCohereModels,
  fetchGeminiModels,
} from "./models-fetchers";
import type { ModelsFetcher } from "./models.types";

export const MODELS_FETCHERS: Record<string, ModelsFetcher> = {
  anthropic: fetchAnthropicModels,
  gemini: fetchGeminiModels,
  cohere: fetchCohereModels,
};

/** Фетчер по provider id; неизвестный id — дефолтный OpenAI-фетчер */
export const getModelsFetcher = (providerId: string): ModelsFetcher =>
  MODELS_FETCHERS[providerId] ?? fetchAvailableModels;
