import type { ApiTemplateProvider } from '@/shared/config/config.types';

/** Результат определения провайдера по API-ключу */
export type ProviderDetectResult =
  | { status: 'resolved'; providerId: ApiTemplateProvider; baseUrl: string }
  | { status: 'unknown' }
  | { status: 'failed' };
