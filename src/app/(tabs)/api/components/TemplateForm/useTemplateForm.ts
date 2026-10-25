import { useCallback, useEffect, useState } from "react";

import { useTemplatesStore } from "@/features/api-templates";
import {
  MODEL_REQUIRES_API_KEY_MESSAGE,
  apiTemplateFormSchema,
} from "@/schemas/api-template";
import { showToast } from "@/shared/components/ui/Toast";
import {
  MODELS_FETCH_DEBOUNCE_MS,
  MODELS_MIN_API_KEY_LENGTH,
} from "@/shared/lib/ai/models.config";
import { useModelsStore } from "@/shared/lib/ai/models-store";
import { useT } from "@/shared/i18n";

import { API_TEMPLATE_PRESETS } from "@/types/api-template";

import type { ApiTemplateProvider } from "@/types/api-template";

/**
 * Форма создания шаблона: поля, zod-валидация, addTemplate, авто-запрос
 * списка моделей по ключу (debounce, кэш в models-store). Ошибки — тост;
 * при успехе поля очищаются. Вся логика — здесь, компонент только рендерит.
 */
export function useTemplateForm() {
  const t = useT();
  const addTemplate = useTemplatesStore((state) => state.addTemplate);

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ApiTemplateProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKeyState] = useState("");
  const [apiKeyError, setApiKeyError] = useState(false);

  // Смена ключа сбрасывает модель (у нового ключа список моделей другой)
  // и абортит in-flight запрос старого ключа в сторе моделей
  const setApiKey = useCallback(
    (text: string) => {
      if (text !== apiKey) {
        setModel("");
        setApiKeyError(false);
        useModelsStore.getState().cancelKey(provider, apiKey);
      }

      setApiKeyState(text);
    },
    [apiKey, provider],
  );

  // Авто-запрос списка моделей: после остановки ввода ключа, если длина
  // достаточная. Повторный ввод того же ключа повторного запроса не делает
  // (кэш стора).
  useEffect(() => {
    if (apiKey.trim().length < MODELS_MIN_API_KEY_LENGTH) return;

    const timer = setTimeout(() => {
      void useModelsStore
        .getState()
        .ensureModels(
          provider,
          API_TEMPLATE_PRESETS[provider].baseUrl,
          apiKey,
        );
    }, MODELS_FETCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [apiKey, provider]);

  const handleAdd = useCallback(async () => {
    const parsed = apiTemplateFormSchema.safeParse({
      name,
      provider,
      model,
      apiKey,
    });

    if (!parsed.success) {
      const keyIssue = parsed.error.issues.some(
        (issue) =>
          issue.path.includes("apiKey") &&
          issue.message === MODEL_REQUIRES_API_KEY_MESSAGE,
      );

      setApiKeyError(keyIssue);
      showToast(keyIssue ? t("apiTab.keyRequired") : t("apiTab.invalidForm"));
      return;
    }

    setApiKeyError(false);

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
    setProvider,
    model,
    setModel,
    apiKey,
    setApiKey,
    apiKeyError,
    handleAdd,
  };
}
