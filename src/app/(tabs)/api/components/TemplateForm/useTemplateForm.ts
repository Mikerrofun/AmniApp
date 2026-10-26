import { useCallback, useEffect, useRef, useState } from "react";

import { useTemplatesStore } from "@/features/api-templates";
import { apiTemplateFormSchema } from "@/schemas/api-template";
import { showToast } from "@/shared/components/ui/Toast";
import { useT } from "@/shared/i18n";
import { useModelsStore } from "@/shared/lib/ai/models-store";
import { MODELS_FETCH_DEBOUNCE_MS } from "@/shared/lib/ai/models.config";

import { API_TAB_ANIMATION } from "../api-tab.animation";
import { API_TEMPLATE_PRESETS } from "@/types/api-template";

import type { ApiTemplateProvider } from "@/types/api-template";

/**
 * Форма создания шаблона: поля, zod-валидация, addTemplate, авто-запрос
 * списка моделей по ключу (debounce, кэш в models-store). Ошибки — тост;
 * при успехе поля гаснут (isClearing), очищаются невидимыми и возвращаются.
 * Вся логика — здесь, компонент только рендерит.
 */
export function useTemplateForm() {
  const t = useT();
  const addTemplate = useTemplatesStore((state) => state.addTemplate);

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ApiTemplateProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKeyState] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
    };
  }, []);

  // Кнопка активна, только когда заполнены все поля (провайдер выбран всегда)
  const canSubmit =
    name.trim() !== "" && model.trim() !== "" && apiKey.trim() !== "";

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

  // Авто-запрос списка моделей: после остановки ввода ключа.
  // Повторный ввод того же ключа повторного запроса не делает (кэш стора).
  useEffect(() => {
    if (!apiKey.trim()) return;

    const timer = setTimeout(() => {
      void useModelsStore
        .getState()
        .ensureModels(provider, API_TEMPLATE_PRESETS[provider].baseUrl, apiKey);
    }, MODELS_FETCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [apiKey, provider]);

  const handleAdd = useCallback(async () => {
    // Повторное нажатие во время анимации очистки — защита от двойного add
    if (isClearing) return;

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

      // Поля гаснут, очищаются невидимыми и возвращаются — тайминги общие
      // со списком, чтобы вход нового шаблона совпадал с очисткой формы
      setIsClearing(true);
      if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        setName("");
        setModel("");
        setApiKeyState("");
        setIsClearing(false);
      }, API_TAB_ANIMATION.formFadeOut);
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
  }, [t, addTemplate, name, provider, model, apiKey, isClearing]);

  return {
    name,
    setName,
    provider,
    setProvider,
    model,
    setModel,
    apiKey,
    setApiKey,
    isClearing,
    canSubmit,
    handleAdd,
  };
}
