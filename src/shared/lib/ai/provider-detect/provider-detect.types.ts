import type { ApiTemplateProvider } from '@/shared/config/config.types';

/** Результат определения провайдера по API-ключу */
export type ProviderDetectResult =
  | {
      status: 'resolved';
      providerId: ApiTemplateProvider;
      baseUrl: string;
      /**
       * Модели победителя probe коллизии; у single-кандидата probe не
       * выполняется — пустой массив (список придет через ensureModels)
       */
      models: string[];
    }
  | { status: 'unknown' }
  | { status: 'failed' };
