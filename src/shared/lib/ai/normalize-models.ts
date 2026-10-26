import type { ProviderModelsResponse } from "./models.types";

/**
 * Нормализует список моделей из ответа провайдера: берет `data[].id`,
 * отбрасывает не-строки и пустые значения, срезает ведущий «~»/«~/»
 * (мусорный префикс некоторых провайдеров — в шаблон и чат-запрос
 * имя модели уходит без него), делает trim, dedup и сортировку.
 * Вынесена в отдельный файл, чтобы тестировать без импорта клиента
 * (models.ts тянет expo/fetch, недоступный в node-тестах).
 */
export function normalizeModelList(payload: unknown): string[] {
  const data = (payload as ProviderModelsResponse | null)?.data;

  if (!Array.isArray(data)) return [];

  const ids = new Set<string>();

  for (const item of data) {
    const id = typeof item?.id === "string" ? cleanModelId(item.id) : "";

    if (id !== "") ids.add(id);
  }

  return [...ids].sort((a, b) => a.localeCompare(b));
}

/** Ведущий «~» или «~/» — артефакт ответа провайдера, не часть имени модели */
function cleanModelId(raw: string): string {
  return raw.trim().replace(/^~\/?/, "");
}
