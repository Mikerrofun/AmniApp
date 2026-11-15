import type { ApiProviderConfig } from './config.types';

/**
 * Реестр провайдеров: провайдер и baseUrl определяются автоматически по
 * префиксу вставленного API-ключа (longest-prefix match). Префиксы и
 * baseUrl сверены с документацией провайдеров. Провайдеры без стабильного
 * префикса (Mistral, Together) не входят — их ключи попадают в ветку
 * «неизвестный префикс» с ручным вводом baseUrl.
 *
 * Gemini / Anthropic / Cohere — официальные OpenAI-совместимые слои
 * (compat-эмуляция): те же baseUrl, говорящие на OpenAI-протоколе.
 */
export const PROVIDER_REGISTRY: ApiProviderConfig[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    // `sk-` коллидирует с DeepSeek — разрешается параллельным probe
    prefixes: ['sk-proj-', 'sk-'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    prefixes: ['sk-or-v1-', 'sk-or-'],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    // `sk-` коллидирует с OpenAI — разрешается параллельным probe
    prefixes: ['sk-'],
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    prefixes: ['gsk_'],
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    prefixes: ['pplx-'],
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    baseUrl: 'https://router.huggingface.co/v1',
    prefixes: ['hf_'],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    prefixes: ['AIza'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    prefixes: ['sk-ant-'],
  },
  {
    id: 'cohere',
    label: 'Cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    prefixes: ['csk-'],
  },
  {
    // Ручной режим: префиксов нет, baseUrl вводит юзер и проходит
    // обязательный probe на OpenAI-совместимость
    id: 'custom',
    label: 'Custom',
    baseUrl: '',
    prefixes: [],
  },
];

/** Конфиг провайдера по id; неизвестный id (старые записи БД) — undefined */
export const getProviderConfig = (
  id: string,
): ApiProviderConfig | undefined =>
  PROVIDER_REGISTRY.find((provider) => provider.id === id);

/** Лейбл провайдера по id; неизвестный id — сам id */
export const getProviderLabel = (id: string): string =>
  getProviderConfig(id)?.label ?? id;
