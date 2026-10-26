import { z } from 'zod';

/** Провайдеры, доступные в шаблонах API (v1: OpenAI-совместимые пресеты) */
export const apiTemplateProviderSchema = z.enum(['openai', 'openrouter']);

export type ApiTemplateProviderId = z.infer<typeof apiTemplateProviderSchema>;

/** Форма создания шаблона API */
export const apiTemplateFormSchema = z.object({
  name: z.string().trim().min(1),
  provider: apiTemplateProviderSchema,
  model: z.string().trim().min(1),
  apiKey: z.string().min(1),
});

export type ApiTemplateForm = z.infer<typeof apiTemplateFormSchema>;

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
