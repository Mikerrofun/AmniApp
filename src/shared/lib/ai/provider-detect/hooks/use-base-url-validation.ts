import { useEffect, useRef, useState } from "react";

import {
  getModelsFetcher,
  probeChatCompletions,
  useModelsStore,
} from "../../models-fetcher";

import { isPasteLikeInsertion } from "@/shared/lib/input";
import { PROVIDER_DETECT_DEBOUNCE_MS } from "../detect/provider-detect.config";
import type {
  UseBaseUrlValidationParams,
  UseBaseUrlValidationResult,
} from "./use-base-url-validation.types";
import { useProviderDetect } from "./use-provider-detect";

export function useBaseUrlValidation({
  apiKey,
  baseUrl,
}: UseBaseUrlValidationParams): UseBaseUrlValidationResult {
  const detect = useProviderDetect(apiKey);

  const trimmedBaseUrl = baseUrl.trim();

  // Доверенная пара: поле не тронуто (или совпадает с реестром) и детект
  // resolved — baseUrl проверять не нужно
  const trusted =
    detect.status === "resolved" &&
    detect.baseUrl !== undefined &&
    trimmedBaseUrl === detect.baseUrl;

  const probeKey = `${trimmedBaseUrl}|${apiKey.trim()}`;
  const [probe, setProbe] = useState<{
    key: string;
    status: UseBaseUrlValidationResult["status"];
    modelsAvailable: boolean;
  } | null>(null);
  const probeControllerRef = useRef<AbortController | null>(null);

  const previousProbeKeyRef = useRef("");

  useEffect(() => {
    const pasted = isPasteLikeInsertion(previousProbeKeyRef.current, probeKey);
    previousProbeKeyRef.current = probeKey;

    if (trusted) return;

    if (trimmedBaseUrl === "" || apiKey.trim() === "") return;

    const runProbe = () => {
      probeControllerRef.current?.abort();
      const controller = new AbortController();
      probeControllerRef.current = controller;

      void (async () => {
        // Фетчер по провайдеру из детекта
        const modelsResult = await getModelsFetcher(detect.provider?.id ?? "")({
          baseUrl: trimmedBaseUrl,
          apiKey,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (modelsResult.ok) {
          useModelsStore
            .getState()
            .receiveModels(trimmedBaseUrl, apiKey, modelsResult.models);

          setProbe({ key: probeKey, status: "ok", modelsAvailable: true });
          return;
        }

        const chatResult = await probeChatCompletions({
          baseUrl: trimmedBaseUrl,
          apiKey,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setProbe({
          key: probeKey,
          status: chatResult.ok ? "ok" : "fail",
          modelsAvailable: false,
        });
      })();
    };

    if (pasted) {
      runProbe();

      return () => {
        probeControllerRef.current?.abort();
      };
    }

    const timer = setTimeout(runProbe, PROVIDER_DETECT_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      probeControllerRef.current?.abort();
    };
  }, [trusted, trimmedBaseUrl, apiKey, probeKey, detect.provider?.id]);

  // Размонтирование формы: обрываем in-flight probe
  useEffect(
    () => () => {
      probeControllerRef.current?.abort();
    },
    [],
  );

  if (trusted) {
    return { status: "ok", baseUrl: trimmedBaseUrl, modelsAvailable: true };
  }

  const current = probe?.key === probeKey ? probe : null;

  return {
    status: current?.status ?? "idle",
    baseUrl: trimmedBaseUrl,
    modelsAvailable: current?.modelsAvailable ?? false,
  };
}
