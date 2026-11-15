import { useCallback, useEffect, useRef, useState } from "react";

import { useTemplatesStore } from "@/features/api-templates";
import { createApiTemplateFormSchema } from "@/schemas/api-template";
import { showToast } from "@/shared/components/ui/Toast";
import { useT } from "@/shared/i18n";
import { fetchAvailableModels } from "@/shared/lib/ai/models";
import { MODELS_FETCH_DEBOUNCE_MS } from "@/shared/lib/ai/models.config";
import { useModelsStore } from "@/shared/lib/ai/models-store";
import { PROVIDER_DETECT_DEBOUNCE_MS } from "@/shared/lib/ai/provider-detect.config";
import { useProviderDetect } from "@/shared/lib/ai/use-provider-detect";

import { API_TAB_ANIMATION } from "../api-tab.animation";

import type { ApiTemplateProvider } from "@/types/api-template";

/** Статус обязательного probe ручного baseUrl */
export type BaseUrlProbeStatus = "idle" | "probing" | "ok" | "fail";

/**
 * Форма создания шаблона: поля, zod-валидация, addTemplate. Провайдер и
 * baseUrl определяются автоматически по префиксу ключа (useProviderDetect);
 * нераспознанный ключ включает ручной ввод baseUrl с обязательным probe.
 * Список моделей запрашивается по ключу (debounce, кэш в models-store).
 * Ошибки — тост; при успехе поля гаснут (isClearing), очищаются
 * невидимыми и возвращаются. Вся логика — здесь, компонент только рендерит.
 */
export function useTemplateForm() {
  const t = useT();
  const addTemplate = useTemplatesStore((state) => state.addTemplate);

  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKeyState] = useState("");
  const [manualBaseUrl, setManualBaseUrlState] = useState("");
  const [baseUrlProbe, setBaseUrlProbe] = useState<BaseUrlProbeStatus>("idle");
  const [isClearing, setIsClearing] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeControllerRef = useRef<AbortController | null>(null);

  const detect = useProviderDetect(apiKey);

  // Ручной режим: префикс не распознан или probe коллизии неуспешен
  const isManual = detect.status === "unknown" || detect.status === "failed";
  const resolvedBaseUrl =
    detect.status === "resolved" && detect.baseUrl
      ? detect.baseUrl
      : manualBaseUrl.trim();
  const providerId: ApiTemplateProvider = detect.provider?.id ?? "custom";
  const baseUrlReady =
    detect.status === "resolved" || baseUrlProbe === "ok";

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
      probeControllerRef.current?.abort();
    };
  }, []);

  // Кнопка активна, только когда заполнены все поля и baseUrl определен
  // (детект resolved ИЛИ ручной baseUrl прошел probe)
  const canSubmit =
    name.trim() !== "" &&
    model.trim() !== "" &&
    apiKey.trim() !== "" &&
    baseUrlReady;

  // Ручной baseUrl: очистка поля сбрасывает probe (событийно, не в эффекте)
  const setManualBaseUrl = useCallback((text: string) => {
    setManualBaseUrlState(text);

    if (text.trim() === "") setBaseUrlProbe("idle");
  }, []);

  const setApiKey = useCallback(
    (text: string) => {
      if (text !== apiKey) {
        setModel("");
        useModelsStore.getState().cancelKey(resolvedBaseUrl, apiKey);
        // Новый ключ — новая попытка детекта: ручной baseUrl сбрасывается
        setManualBaseUrl("");
        setBaseUrlProbe("idle");
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

  // Обязательный probe ручного baseUrl: после остановки ввода. Неуспех
  // (401/403/сеть/не-OpenAI-формат) — ошибка на поле + toast, сабмит
  // заблокирован через canSubmit.
  useEffect(() => {
    if (!isManual) return;

    const baseUrl = manualBaseUrl.trim();

    if (baseUrl === "" || apiKey.trim() === "") return;

    const timer = setTimeout(() => {
      probeControllerRef.current?.abort();
      const controller = new AbortController();
      probeControllerRef.current = controller;

      setBaseUrlProbe("probing");

      void fetchAvailableModels({ baseUrl, apiKey, signal: controller.signal }).then(
        (result) => {
          if (controller.signal.aborted) return;

          if (result.ok) {
            setBaseUrlProbe("ok");
          } else {
            setBaseUrlProbe("fail");
            showToast(t("apiTab.baseUrlNotCompatible"));
          }
        },
      );
    }, PROVIDER_DETECT_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      probeControllerRef.current?.abort();
    };
  }, [isManual, manualBaseUrl, apiKey, t]);

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
        setBaseUrlProbe("idle");
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
    detectStatus: detect.status,
    providerLabel: detect.provider?.label,
    resolvedBaseUrl,
    isManual,
    manualBaseUrl,
    setManualBaseUrl,
    baseUrlProbe,
    baseUrlReady,
    isClearing,
    canSubmit,
    handleAdd,
  };
}
