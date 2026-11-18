import { useCallback, useEffect, useRef, useState } from "react";

import { useTemplatesStore } from "@/features/api-templates";
import { createApiTemplateFormSchema } from "@/schemas/api-template";
import { showToast } from "@/shared/components/ui/Toast";
import { useT } from "@/shared/i18n";
import {
  modelsCacheKey,
  useModelsStore,
} from "@/shared/lib/ai/models-fetcher";
import {
  useBaseUrlValidation,
  useProviderDetect,
} from "@/shared/lib/ai/provider-detect";

import { API_TAB_ANIMATION } from "../api-tab.animation";

import type { ApiTemplateProvider } from "@/types/api-template";

/**
 * Форма создания шаблона: поля, zod-валидация, addTemplate. Провайдер
 * определяется по префиксу ключа и не меняется при правке baseUrl.
 * Поле baseUrl одно и всегда видимо: авто-детект подставляет реестровый
 * baseUrl, пока поле не тронуто юзером; измененное значение уходит в
 * probe хука useBaseUrlValidation. Список моделей запрашивается только
 * когда endpoint отдал список (modelsAvailable); при fallback-only
 * endpoint модель вводят вручную. Ошибки — тост; при успехе поля гаснут
 * (isClearing), очищаются невидимыми и возвращаются. Вся логика — здесь,
 * компонент только рендерит.
 */
export function useTemplateForm() {
  const t = useT();
  const addTemplate = useTemplatesStore((state) => state.addTemplate);

  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKeyState] = useState("");
  const [baseUrl, setBaseUrlState] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detect = useProviderDetect(apiKey);

  const {
    status: baseUrlStatus,
    baseUrl: resolvedBaseUrl,
    modelsAvailable,
  } = useBaseUrlValidation({ apiKey, baseUrl });

  const providerId: ApiTemplateProvider = detect.provider?.id ?? "custom";
  const baseUrlReady = baseUrlStatus === "ok";

  // Доверенная пара: детект resolved и поле совпадает с реестровым
  // baseUrl — схема не требует заполнения (оно и так заполнено)
  const isTrusted =
    detect.status === "resolved" &&
    detect.baseUrl !== undefined &&
    baseUrl.trim() === detect.baseUrl;

  // Последнее авто-подставленное значение: поле считается «не тронутым
  // юзером», пока оно пустое или равно предыдущему авто-значению
  const lastAutoBaseUrlRef = useRef("");

  // Префилл: детект resolved → реестровый baseUrl в поле, если юзер его
  // не правил; отредактированное значение не трогается — оно уйдет в probe
  useEffect(() => {
    if (detect.status !== "resolved" || !detect.baseUrl) return;

    const current = baseUrl.trim();

    if (current === "" || current === lastAutoBaseUrlRef.current) {
      lastAutoBaseUrlRef.current = detect.baseUrl;
      setBaseUrlState(detect.baseUrl);
    }
  }, [detect.status, detect.baseUrl, baseUrl]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
    };
  }, []);

  // Кнопка активна, только когда заполнены все поля и baseUrl проверен
  const canSubmit =
    name.trim() !== "" &&
    model.trim() !== "" &&
    apiKey.trim() !== "" &&
    baseUrlReady;

  const setBaseUrl = useCallback((text: string) => {
    setBaseUrlState(text);
  }, []);

  const setApiKey = useCallback(
    (text: string) => {
      if (text !== apiKey) {
        setModel("");
        useModelsStore.getState().cancelKey(resolvedBaseUrl, apiKey);
        // Новый ключ — новая попытка детекта: поле baseUrl очищается
        lastAutoBaseUrlRef.current = "";
        setBaseUrlState("");
      }

      setApiKeyState(text);
    },
    [apiKey, resolvedBaseUrl],
  );

  // Авто-запрос списка моделей: сразу, как только baseUrl проверен и
  // endpoint отдал список — второй debounce не нужен, ввод ключа уже
  // отфильтрован debounce детекта. При fallback-only endpoint запросать
  // список бессмысленно. Повторный вызов повторного запроса не делает
  // (кэш стора по baseUrl|apiKey + in-flight дедупликация).
  useEffect(() => {
    if (
      !apiKey.trim() ||
      !baseUrlReady ||
      !modelsAvailable ||
      resolvedBaseUrl === ""
    ) {
      return;
    }

    void useModelsStore
      .getState()
      .ensureModels(providerId, resolvedBaseUrl, apiKey);
  }, [apiKey, providerId, resolvedBaseUrl, baseUrlReady, modelsAvailable]);

  // Сверка выбранной модели со списком: модель, которой нет в готовом
  // списке, очищается (покрывает и смену baseUrl, и смену ключа).
  // Только очистка — авто-выбор модели не делается. Корректировка
  // состояния во время рендера при смене записи кэша — рекомендованный
  // React-паттерн вместо setState в эффекте
  const modelsEntry = useModelsStore((state) =>
    state.entries[modelsCacheKey(resolvedBaseUrl, apiKey)],
  );
  const [prevModelsEntry, setPrevModelsEntry] = useState(modelsEntry);

  if (prevModelsEntry !== modelsEntry) {
    setPrevModelsEntry(modelsEntry);

    const selected = model.trim();

    if (
      modelsEntry?.status === "ready" &&
      selected !== "" &&
      !modelsEntry.models.includes(selected)
    ) {
      setModel("");
    }
  }

  const handleAdd = useCallback(async () => {
    // Повторное нажатие во время анимации очистки — защита от двойного add
    if (isClearing) return;

    const parsed = createApiTemplateFormSchema({
      baseUrlRequired: !isTrusted,
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
        setBaseUrlState("");
        lastAutoBaseUrlRef.current = "";
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
    isTrusted,
    isClearing,
  ]);

  return {
    name,
    setName,
    model,
    setModel,
    apiKey,
    setApiKey,
    baseUrl,
    setBaseUrl,
    resolvedBaseUrl,
    baseUrlReady,
    modelsAvailable,
    isClearing,
    canSubmit,
    handleAdd,
  };
}
