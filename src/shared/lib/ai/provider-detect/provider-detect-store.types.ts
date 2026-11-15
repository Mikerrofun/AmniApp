import type { ProviderDetectResult } from './provider-detect.types';

/** Статус определения провайдера для одной записи кэша (по apiKey) */
export type ProviderDetectStatus =
  | ProviderDetectResult['status']
  | 'detecting';

/** Запись кэша детекта: in-memory на сессию, не персистится */
export type ProviderDetectEntry = {
  status: ProviderDetectStatus;
  /** Заполнено при status = resolved */
  providerId?: string;
  /** Заполнено при status = resolved */
  baseUrl?: string;
};

export type ProviderDetectState = {
  /** Ключ записи — apiKey (см. ensureDetect) */
  entries: Record<string, ProviderDetectEntry>;
  /**
   * Обеспечивает результат детекта: финальный статус — из кэша без
   * запроса, detecting — не запускает второй probe (in-flight
   * дедупликация), иначе выполняет resolveProvider.
   */
  ensureDetect: (apiKey: string, signal?: AbortSignal) => Promise<void>;
  /** Абортит in-flight probe по ключу и удаляет запись кэша */
  cancelKey: (apiKey: string) => void;
};
