/** Провайдер шаблона API (OpenAI-совместимый протокол) */
export type ApiTemplateProvider = 'openai' | 'openrouter';

/** Пресет провайдера: baseUrl берется из пресета, не вводится вручную */
export type ApiTemplatePreset = {
  id: ApiTemplateProvider;
  label: string;
  baseUrl: string;
};

/** Доступные пресеты провайдеров */
export const API_TEMPLATE_PRESETS: Record<
  ApiTemplateProvider,
  ApiTemplatePreset
> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
};
