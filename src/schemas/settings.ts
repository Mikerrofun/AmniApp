import { z } from 'zod';

// Supported AI providers. OpenRouter first; the registry in
// src/lib/ai/providers.ts maps each id to its API details.
export const providerIdSchema = z.enum([
  'openrouter',
  'openai',
  'anthropic',
  'google',
  'custom',
]);

export type ProviderId = z.infer<typeof providerIdSchema>;

export const providerSettingsSchema = z.object({
  provider: providerIdSchema,
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().min(1, 'Model is required'),
  temperature: z.number().min(0).max(2).default(0.7),
  // Optional proxy base URL for regions where a provider is blocked.
  baseUrl: z.string().url().optional(),
});

export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
