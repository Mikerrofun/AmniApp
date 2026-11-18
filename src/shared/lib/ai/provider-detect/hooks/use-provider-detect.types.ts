import type { ApiProviderConfig } from '@/shared/config/config.types';

import type { ProviderDetectStatus } from '../store/provider-detect-store.types';

/** Результат хука автоопределения провайдера по ключу */
export type UseProviderDetectResult = {
  status: ProviderDetectStatus;
  /** Конфиг распознанного провайдера (для лейбла); нет при остальных статусах */
  provider?: ApiProviderConfig;
  /** OpenAI-совместимый baseUrl распознанного провайдера */
  baseUrl?: string;
};
