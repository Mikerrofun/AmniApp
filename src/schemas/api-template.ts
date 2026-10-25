import { z } from 'zod';

/** Провайдеры, доступные в шаблонах API (v1: OpenAI-совместимые пресеты) */
export const apiTemplateProviderSchema = z.enum(['openai', 'openrouter']);

export type ApiTemplateProviderId = z.infer<typeof apiTemplateProviderSchema>;

/**
 * Сообщение superRefine-правила «модель требует ключ». Проверяется
 * в useTemplateForm, чтобы отличить это правило от остальных ошибок.
 */
export const MODEL_REQUIRES_API_KEY_MESSAGE = 'Model requires an API key';

/** Форма создания шаблона API */
export const apiTemplateFormSchema = z
  .object({
    name: z.string().trim().min(1),
    provider: apiTemplateProviderSchema,
    model: z.string().trim().min(1),
    apiKey: z.string().min(1),
  })
  // Ошибка вешается на apiKey, а не на модель: поле ключа — причина
  .superRefine((value, ctx) => {
    if (value.model.trim() !== '' && value.apiKey.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['apiKey'],
        message: MODEL_REQUIRES_API_KEY_MESSAGE,
      });
    }
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
