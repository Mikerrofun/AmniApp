import { useEffect, useRef, useState } from 'react';

import { fetchAvailableModels } from '../models-fetcher';

import { PROVIDER_DETECT_DEBOUNCE_MS } from './provider-detect.config';
import { useProviderDetect } from './use-provider-detect';
import type {
  UseBaseUrlValidationParams,
  UseBaseUrlValidationResult,
} from './use-base-url-validation.types';

/**
 * Единый механизм валидации baseUrl формы шаблона, используется в обоих
 * режимах: auto валидирует пару «детект по префиксу ключа + ключ» через
 * useProviderDetect, manual — обязательный probe введенного вручную
 * baseUrl через fetchAvailableModels (тот же debounce, что у детекта).
 * Статус только финальный: idle / ok / fail — промежуточный «проверяем»
 * наружу не показывается.
 */
export function useBaseUrlValidation({
  mode,
  apiKey,
  manualBaseUrl = '',
}: UseBaseUrlValidationParams): UseBaseUrlValidationResult {
  const detect = useProviderDetect(apiKey);

  // Ручной probe: статус ключуется парой «baseUrl|ключ» — смена любого
  // слагаемого мгновенно возвращает idle без set-state в теле эффекта
  const probeKey = `${manualBaseUrl.trim()}|${apiKey.trim()}`;
  const [probe, setProbe] = useState<{
    key: string;
    status: UseBaseUrlValidationResult['status'];
  } | null>(null);
  const probeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (mode !== 'manual') return;

    const baseUrl = manualBaseUrl.trim();

    if (baseUrl === '' || apiKey.trim() === '') return;

    const timer = setTimeout(() => {
      probeControllerRef.current?.abort();
      const controller = new AbortController();
      probeControllerRef.current = controller;

      void fetchAvailableModels({
        baseUrl,
        apiKey,
        signal: controller.signal,
      }).then((result) => {
        if (controller.signal.aborted) return;

        setProbe({ key: probeKey, status: result.ok ? 'ok' : 'fail' });
      });
    }, PROVIDER_DETECT_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      probeControllerRef.current?.abort();
    };
  }, [mode, manualBaseUrl, apiKey, probeKey]);

  // Размонтирование формы: обрываем in-flight probe
  useEffect(
    () => () => {
      probeControllerRef.current?.abort();
    },
    [],
  );

  if (mode === 'manual') {
    return {
      status: probe?.key === probeKey ? probe.status : 'idle',
      baseUrl: manualBaseUrl.trim(),
    };
  }

  return {
    status:
      detect.status === 'resolved'
        ? 'ok'
        : detect.status === 'unknown' || detect.status === 'failed'
          ? 'fail'
          : 'idle',
    baseUrl: detect.status === 'resolved' && detect.baseUrl ? detect.baseUrl : '',
  };
}
