import { useCallback, useState } from "react";

import { useTemplatesStore } from "@/features/api-templates";
import { apiTemplateFormSchema } from "@/schemas/api-template";
import { showToast } from "@/shared/components/ui/Toast";
import { useT } from "@/shared/i18n";

import type { ApiTemplateProvider } from "@/types/api-template";

/**
 * Форма создания шаблона: поля, zod-валидация, addTemplate.
 * Ошибки — тост; при успехе поля очищаются. Вся логика — здесь,
 * компонент только рендерит.
 */
export function useTemplateForm() {
  const t = useT();
  const addTemplate = useTemplatesStore((state) => state.addTemplate);

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ApiTemplateProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

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
      setApiKey("");
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
    handleAdd,
  };
}
