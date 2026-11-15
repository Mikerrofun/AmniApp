import { fetchAvailableModels } from './models';
import type { ModelsFetcher } from './models.types';
import {
  fetchAnthropicModels,
  fetchCohereModels,
  fetchGeminiModels,
} from './models-fetchers';

/**
 * Реестр фетчеров моделей по provider id: известные провайдеры с
 * не-OpenAI списком моделей получают нативный запрос + свой парсер,
 * для всех остальных — дефолтный OpenAI-запрос (fetchAvailableModels).
 */
export const MODELS_FETCHERS: Record<string, ModelsFetcher> = {
  anthropic: fetchAnthropicModels,
  gemini: fetchGeminiModels,
  cohere: fetchCohereModels,
};

/** Фетчер по provider id; неизвестный id — дефолтный OpenAI-фетчер */
export const getModelsFetcher = (providerId: string): ModelsFetcher =>
  MODELS_FETCHERS[providerId] ?? fetchAvailableModels;
