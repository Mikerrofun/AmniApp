/** Элемент ответа Gemini GET /models */
export type GeminiModelItem = {
  name?: unknown;
};

/** Тело ответа Gemini GET /models */
export type GeminiModelsResponse = {
  models?: GeminiModelItem[];
};

/**
 * Парсер нативного ответа Gemini GET /models: `models[].name` вида
 * «models/gemini-2.0-flash» — префикс `models/` срезается, в шаблон
 * и чат-запрос имя модели уходит без него.
 */
export function parseGeminiModelList(payload: unknown): string[] {
  const models = (payload as GeminiModelsResponse | null)?.models;

  if (!Array.isArray(models)) return [];

  const names = new Set<string>();

  for (const item of models) {
    const raw = typeof item?.name === 'string' ? item.name.trim() : '';
    const name = raw.replace(/^models\//, '');

    if (name !== '') names.add(name);
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}
