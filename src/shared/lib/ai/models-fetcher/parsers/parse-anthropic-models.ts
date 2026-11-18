import type { ProviderModelsResponse } from '../fetchers/models-fetcher.types';

/**
 * Парсер нативного ответа Anthropic GET /models: `data[].id` — тот же
 * формат, что OpenAI, но парсер отдельный, чтобы тестироваться без
 * expo/fetch и не зависеть от нормализации OpenAI-ответа.
 */
export function parseAnthropicModelList(payload: unknown): string[] {
  const data = (payload as ProviderModelsResponse | null)?.data;

  if (!Array.isArray(data)) return [];

  const ids = new Set<string>();

  for (const item of data) {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';

    if (id !== '') ids.add(id);
  }

  return [...ids].sort((a, b) => a.localeCompare(b));
}
