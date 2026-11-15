import { useCallback, useEffect, useRef, useState } from "react";

import { useTemplatesStore } from "@/features/api-templates";
import { createApiTemplateFormSchema } from "@/schemas/api-template";
import { showToast } from "@/shared/components/ui/Toast";
import { useT } from "@/shared/i18n";
import {
  MODELS_FETCH_DEBOUNCE_MS,
  useModelsStore,
} from "@/shared/lib/ai/models-fetcher";
import {
  useBaseUrlValidation,
  useProviderDetect,
} from "@/shared/lib/ai/provider-detect";

import { API_TAB_ANIMATION } from "../api-tab.animation";

import type { ApiTemplateProvider } from "@/types/api-template";

/**
 * Форма создания шаблона: поля, zod-валидация, addTemplate. Провайдер и
 * baseUrl определяются автоматически по префиксу ключа; нераспознанный
 * ключ включает ручной ввод baseUrl. Валидация пары «baseUrl + ключ» —
 * единый механизм useBaseUrlValidation для обоих режимов. Список моделей
 * запрашивается по ключу (debounce, кэш в models-store). Ошибки — тост;
 * при успехе поля гаснут (isClearing), очищаются невидимыми и
 * возвращаются. Вся логика — здесь, компонент только рендерит.
 */
export function useTemplateForm() {
  const t = useT();
  const addTemplate = useTemplatesStore((state) => state.addTemplate);

  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKeyState] = useState("");
  const [manualBaseUrl, setManualBaseUrlState] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detect = useProviderDetect(apiKey);

  // Ручной режим: префикс не распознан или probe коллизии неуспешен
  const isManual = detect.status === "unknown" || detect.status === "failed";

  // Единая валидация baseUrl: auto — детект по префиксу, manual —
  // обязательный probe ручного ввода. Статус только ok/fail/idle.
  const {
    status: baseUrlStatus,
    baseUrl: validatedBaseUrl,
  } = useBaseUrlValidation({
    mode: isManual ? "manual" : "auto",
    apiKey,
    manualBaseUrl: isManual ? manualBaseUrl : undefined,
  });

  const providerId: ApiTemplateProvider = detect.provider?.id ?? "custom";
  const resolvedBaseUrl = validatedBaseUrl;
  const baseUrlReady = baseUrlStatus === "ok";

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
    };
  }, []);

  // Кнопка активна, только когда заполнены все поля и baseUrl определен
  // (детект resolved ИЛИ ручной baseUrl прошел probe)
  const canSubmit =
    name.trim() !== "" &&
    model.trim() !== "" &&
    apiKey.trim() !== "" &&
    baseUrlReady;

  const setManualBaseUrl = useCallback((text: string) => {
    setManualBaseUrlState(text);
  }, []);

  const setApiKey = useCallback(
    (text: string) => {
      if (text !== apiKey) {
        setModel("");
        useModelsStore.getState().cancelKey(resolvedBaseUrl, apiKey);
        // Новый ключ — новая попытка детекта: ручной baseUrl сбрасывается
        setManualBaseUrl("");
      }

      setApiKeyState(text);
    },
    [apiKey, resolvedBaseUrl, setManualBaseUrl],
  );

  // Авто-запрос списка моделей: после остановки ввода ключа, когда
  // baseUrl определен. Повторный ввод того же ключа повторного запроса
  // не делает (кэш стора по baseUrl|apiKey).
  useEffect(() => {
    if (!apiKey.trim() || !baseUrlReady || resolvedBaseUrl === "") return;

    const timer = setTimeout(() => {
      void useModelsStore
        .getState()
        .ensureModels(providerId, resolvedBaseUrl, apiKey);
    }, MODELS_FETCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [apiKey, providerId, resolvedBaseUrl, baseUrlReady]);

  const handleAdd = useCallback(async () => {
    // Повторное нажатие во время анимации очистки — защита от двойного add
    if (isClearing) return;

    const parsed = createApiTemplateFormSchema({
      baseUrlRequired: isManual,
    }).safeParse({
      name,
      provider: providerId,
      baseUrl: resolvedBaseUrl,
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
        parsed.data.baseUrl,
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
        setManualBaseUrl("");
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
  }, [
    t,
    addTemplate,
    name,
    providerId,
    resolvedBaseUrl,
    model,
    apiKey,
    isManual,
    isClearing,
    setManualBaseUrl,
  ]);

  return {
    name,
    setName,
    model,
    setModel,
    apiKey,
    setApiKey,
    providerLabel: detect.provider?.label,
    resolvedBaseUrl,
    isManual,
    manualBaseUrl,
    setManualBaseUrl,
    baseUrlReady,
    isClearing,
    canSubmit,
    handleAdd,
  };
}
