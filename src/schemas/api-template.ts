import { z } from 'zod';

import type { ApiTemplateProvider } from '@/shared/config/config.types';
import { PROVIDER_REGISTRY } from '@/shared/config/providers.config';

/**
 * Провайдеры шаблона API выводятся из реестра PROVIDER_REGISTRY —
 * единственного источника id провайдеров; отдельный список не дублируется.
 */
const providerIds = PROVIDER_REGISTRY.map((provider) => provider.id) as [
  ApiTemplateProvider,
  ...ApiTemplateProvider[],
];

export const apiTemplateProviderSchema = z.enum(providerIds);

export type ApiTemplateProviderId = z.infer<typeof apiTemplateProviderSchema>;

/** Base URL ручного режима: пустая строка либо валидный URL */
const apiTemplateBaseUrlSchema = z.union([z.literal(''), z.url()]);

/** Форма создания шаблона API */
export const apiTemplateFormSchema = z.object({
  name: z.string().trim().min(1),
  provider: apiTemplateProviderSchema,
  baseUrl: apiTemplateBaseUrlSchema,
  model: z.string().trim().min(1),
  apiKey: z.string().min(1),
});

export type ApiTemplateForm = z.infer<typeof apiTemplateFormSchema>;

/**
 * Схема с правилом ручного режима: пока детект не resolved, baseUrl
 * обязателен (probe совместимости выполняет форма). При resolved-детекте
 * baseUrl приходит из реестра — правило не срабатывает.
 */
export function createApiTemplateFormSchema({
  baseUrlRequired,
}: {
  baseUrlRequired: boolean;
}) {
  return apiTemplateFormSchema.superRefine((data, ctx) => {
    if (!baseUrlRequired) return;

    if (data.baseUrl === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: 'baseUrl is required in manual mode',
      });
    }
  });
}

/** SSE-чанк стримингового ответа /chat/completions */
export const chatCompletionChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullish(),
          })
          .nullish(),
        finish_reason: z.string().nullish(),
      }),
    )
    .min(1),
});

/** Тело ошибки OpenAI-совместимого API */
export const chatCompletionErrorSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
    })
    .optional(),
});
