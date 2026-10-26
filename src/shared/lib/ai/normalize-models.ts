import type { ProviderModelsResponse } from "./models.types";

/**
 * Нормализует список моделей из ответа провайдера: берет `data[].id`,
 * отбрасывает не-строки и пустые значения, делает trim, dedup и сортировку.
 * Вынесена в отдельный файл, чтобы тестировать без импорта клиента
 * (models.ts тянет expo/fetch, недоступный в node-тестах).
 */
export function normalizeModelList(payload: unknown): string[] {
  const data = (payload as ProviderModelsResponse | null)?.data;

  if (!Array.isArray(data)) return [];

  const ids = new Set<string>();

  for (const item of data) {
    if (typeof item?.id !== "string") continue;

    const id = item.id.trim();

    if (id !== "") ids.add(id);
  }

  return [...ids].sort((a, b) => a.localeCompare(b));
}
