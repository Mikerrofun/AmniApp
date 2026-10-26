import { useMemo, useState } from "react";

import { modelsCacheKey, useModelsStore } from "@/shared/lib/ai/models-store";

import { EMPTY_MODELS } from "./ModelSelect.config";
import type { ModelSelectProps } from "./ModelSelect.types";
import { filterModels } from "./filter-models";

type UseModelSelectArgs = Pick<
  ModelSelectProps,
  "provider" | "apiKey" | "disabled"
>;

/**
 * Вся логика селекта модели: состояние открыт/закрыт, поисковый запрос,
 * чтение записи кэша стора моделей и производные флаги. Компонент
 * только рендерит состояния по status.
 */
export function useModelSelect({
  provider,
  apiKey,
  disabled = false,
}: UseModelSelectArgs) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const cacheKey = modelsCacheKey(provider, apiKey);
  const entry = useModelsStore((state) => state.entries[cacheKey]);
  const status = entry?.status ?? "idle";
  const models = entry?.models ?? EMPTY_MODELS;

  const hasList = status === "ready" && models.length > 0;
  const filtered = useMemo(
    () => filterModels(models, query),
    [models, query],
  );

  // Дропдаун заблокирован без ключа: список моделей неоткуда получить
  const isDropdownLocked = disabled || apiKey.trim() === "";

  const openDropdown = () => {
    if (isDropdownLocked) return;

    setQuery("");
    setIsOpen(true);
  };

  const closeDropdown = () => setIsOpen(false);

  return {
    isOpen,
    query,
    setQuery,
    status,
    hasList,
    filtered,
    isDropdownLocked,
    openDropdown,
    closeDropdown,
  };
}
