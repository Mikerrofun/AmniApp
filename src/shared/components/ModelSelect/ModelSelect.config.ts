/** Конфигурация селекта модели */

/** Максимальная высота скролл-списка моделей (FlatList виртуализован) */
export const MODEL_LIST_MAX_HEIGHT = 240;

/** Единый класс полей селекта: кнопка, ручной ввод, поиск в дропдауне */
export const FIELD_CLASS =
  "rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary";

/** Стабильная пустая ссылка, чтобы useMemo по models не пересоздавался */
export const EMPTY_MODELS: string[] = [];
