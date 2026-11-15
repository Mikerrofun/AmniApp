import { useEffect, useRef } from 'react';

import type { ApiProviderConfig } from '@/shared/config/config.types';
import { getProviderConfig } from '@/shared/config/providers.config';

import { PROVIDER_DETECT_DEBOUNCE_MS } from './provider-detect.config';
import { useProviderDetectStore } from './provider-detect-store';
import type { ProviderDetectStatus } from './provider-detect-store.types';

type UseProviderDetectResult = {
  status: ProviderDetectStatus;
  /** Конфиг распознанного провайдера (для лейбла); нет при остальных статусах */
  provider?: ApiProviderConfig;
  /** OpenAI-совместимый baseUrl распознанного провайдера */
  baseUrl?: string;
};

/**
 * Автоопределение провайдера по вставленному ключу: debounce из конфига
 * детекта, запуск ensureDetect, отмена in-flight probe при смене ключа.
 * Повторная вставка того же ключа берется из кэша стора — запроса нет.
 */
export function useProviderDetect(apiKey: string): UseProviderDetectResult {
  const trimmed = apiKey.trim();

  const entry = useProviderDetectStore((state) => state.entries[trimmed]);

  useEffect(() => {
    if (trimmed === '') return;

    const timer = setTimeout(() => {
      void useProviderDetectStore.getState().ensureDetect(trimmed);
    }, PROVIDER_DETECT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  // Смена ключа абортит старый probe и сбрасывает его запись; ответ от
  // старого ключа не перезаписывает состояние новой записи (записи
  // стора ключуются по apiKey)
  const previousKeyRef = useRef(trimmed);

  useEffect(() => {
    const previous = previousKeyRef.current;

    if (previous !== trimmed && previous !== '') {
      useProviderDetectStore.getState().cancelKey(previous);
    }

    previousKeyRef.current = trimmed;
  }, [trimmed]);

  const provider = entry?.providerId
    ? getProviderConfig(entry.providerId)
    : undefined;

  return {
    status: entry?.status ?? 'idle',
    provider,
    baseUrl: entry?.baseUrl,
  };
}
