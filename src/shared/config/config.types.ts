/**
 * Провайдер шаблона API (OpenAI-совместимый протокол). Юнион расширен
 * под все id реестра провайдеров + ручной режим; старые значения
 * 'openai'/'openrouter' остаются валидными.
 */
export type ApiTemplateProvider =
  | 'openai'
  | 'openrouter'
  | 'deepseek'
  | 'groq'
  | 'perplexity'
  | 'huggingface'
  | 'gemini'
  | 'anthropic'
  | 'cohere'
  | 'custom';

/** Запись реестра провайдеров: префиксы ключей + OpenAI-совместимый baseUrl */
export type ApiProviderConfig = {
  id: ApiTemplateProvider;
  label: string;
  /**
   * OpenAI-совместимый endpoint без завершающего слеша (запросы строятся
   * конкатенацией `{baseUrl}/models`). Пустая строка — baseUrl вводит
   * юзер (ручной режим custom).
   */
  baseUrl: string;
  /** Префиксы API-ключей для автоопределения; пустой массив — ручной режим */
  prefixes: string[];
};
