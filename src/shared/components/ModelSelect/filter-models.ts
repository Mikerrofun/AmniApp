/** Фильтр списка моделей: case-insensitive подстрока в любом месте id */
export function filterModels(models: string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();

  if (normalized === '') return models;

  return models.filter((id) => id.toLowerCase().includes(normalized));
}
