import type { ProviderId } from '@/schemas/settings';

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  // Popular starter models shown in Settings before a custom pick.
  defaultModels: string[];
};

// BYOK registry: the app talks to these APIs directly from the device,
// so only public endpoints belong here. API keys are stored per provider
// in expo-secure-store (see src/lib/secure-store.ts, to be added).
export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: [
      'google/gemini-2.0-flash-001',
      'anthropic/claude-sonnet-4',
      'openai/gpt-4.1-mini',
    ],
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4.1-mini', 'gpt-4.1'],
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-sonnet-4', 'claude-haiku-4'],
  },
  google: {
    id: 'google',
    label: 'Google AI',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModels: ['gemini-2.0-flash', 'gemini-2.5-pro'],
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    defaultBaseUrl: '',
    defaultModels: [],
  },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);
