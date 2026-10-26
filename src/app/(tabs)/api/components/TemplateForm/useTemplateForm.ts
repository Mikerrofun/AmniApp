import { useCallback, useEffect, useRef, useState } from "react";

import { useTemplatesStore } from "@/features/api-templates";
import { apiTemplateFormSchema } from "@/schemas/api-template";
import { showToast } from "@/shared/components/ui/Toast";
import { MODELS_FETCH_DEBOUNCE_MS } from "@/shared/lib/ai/models.config";
import { useModelsStore } from "@/shared/lib/ai/models-store";
import { useT } from "@/shared/i18n";

import { API_TEMPLATE_PRESETS } from "@/types/api-template";

import type { ApiTemplateProvider } from "@/types/api-template";

/**
 * Форма создания шаблона: поля, zod-валидация, addTemplate, авто-запрос
 * списка моделей по ключу (вставка — сразу, ручной ввод — по паузе,
 * потеря фокуса — сразу; кэш в models-store). Ошибки — тост; при успехе
 * поля очищаются. Вся логика — здесь, компонент только рендерит.
 */
export function useTemplateForm() {
  const t = useT();
  const addTemplate = useTemplatesStore((state) => state.addTemplate);

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ApiTemplateProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKeyState] = useState("");
  // Прошлое значение ключа: скачок длины больше символа — вставка из буфера
  const prevKeyRef = useRef("");

  // Смена ключа сбрасывает модель (у нового ключа список моделей другой)
  // и подчищает in-flight запрос и кэш старого ключа в сторе моделей
  const setApiKey = useCallback(
    (text: string) => {
      if (text !== apiKey) {
        setModel("");
        useModelsStore.getState().cancelKey(provider, apiKey);
      }

      setApiKeyState(text);
    },
    [apiKey, provider],
  );

  // Смена провайдера тоже сбрасывает модель: список у другого провайдера
  // другой. Кэш старой записи не чистим — она валидна, провайдер могут
  // вернуть обратно
  const changeProvider = useCallback(
    (next: ApiTemplateProvider) => {
      if (next === provider) return;

      setModel("");
      setProvider(next);
    },
    [provider],
  );

  // Авто-запрос списка моделей. Длину ключа не проверяем — ключи бывают
  // очень короткие, единственное условие непустой ключ. Вставка из буфера
  // запрашивает список сразу, ручной ввод — после секунды без новых
  // символов. Повторный запрос того же ключа — no-op (кэш стора)
  useEffect(() => {
    if (apiKey.trim() === "") {
      prevKeyRef.current = apiKey;
      return;
    }

    const isPasted = apiKey.length - prevKeyRef.current.length > 1;
    prevKeyRef.current = apiKey;

    const timer = setTimeout(
      () => {
        void useModelsStore
          .getState()
          .ensureModels(
            provider,
            API_TEMPLATE_PRESETS[provider].baseUrl,
            apiKey,
          );
      },
      isPasted ? 0 : MODELS_FETCH_DEBOUNCE_MS,
    );

    return () => clearTimeout(timer);
  }, [apiKey, provider]);

  // Потеря фокуса поля ключа — мгновенный запрос, не дожидаясь паузы ввода
  const handleApiKeyBlur = useCallback(() => {
    if (apiKey.trim() === "") return;

    void useModelsStore
      .getState()
      .ensureModels(provider, API_TEMPLATE_PRESETS[provider].baseUrl, apiKey);
  }, [apiKey, provider]);

  const handleAdd = useCallback(async () => {
    const parsed = apiTemplateFormSchema.safeParse({
      name,
      provider,
      model,
      apiKey,
    });

    if (!parsed.success) {
      showToast(t("apiTab.invalidForm"));
      return;
    }

    try {
      await addTemplate(
        parsed.data.name,
        parsed.data.provider,
        parsed.data.model,
        parsed.data.apiKey,
      );

      setName("");
      setModel("");
      setApiKeyState("");
    } catch (error) {
      console.log("[v0] createTemplate failed:", error);
      // UNIQUE(name) — самый вероятный отказ вставки; остальные ошибки
      // (например, отказ SecureStore) показываем отдельным тостом
      const message = error instanceof Error ? error.message : "";
      showToast(
        message.includes("UNIQUE")
          ? t("apiTab.duplicateName")
          : t("apiTab.saveFailed"),
      );
    }
  }, [t, addTemplate, name, provider, model, apiKey]);

  return {
    name,
    setName,
    provider,
    setProvider: changeProvider,
    model,
    setModel,
    apiKey,
    setApiKey,
    handleApiKeyBlur,
    handleAdd,
  };
}
