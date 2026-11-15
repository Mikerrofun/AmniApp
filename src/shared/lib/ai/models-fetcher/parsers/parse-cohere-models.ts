/** Элемент ответа Cohere GET /models */
export type CohereModelItem = {
  name?: unknown;
};

/** Тело ответа Cohere GET /models */
export type CohereModelsResponse = {
  models?: CohereModelItem[];
};

/** Парсер нативного ответа Cohere GET /models: `models[].name` */
export function parseCohereModelList(payload: unknown): string[] {
  const models = (payload as CohereModelsResponse | null)?.models;

  if (!Array.isArray(models)) return [];

  const names = new Set<string>();

  for (const item of models) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';

    if (name !== '') names.add(name);
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}
