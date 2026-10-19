import type { ApiTemplateProvider } from '@/shared/config/config.types';

// Пресеты провайдеров живут в shared/config (config.types.ts),
// здесь только реэкспорт для обратной совместимости импортов
export {
  API_TEMPLATE_PRESETS,
  type ApiTemplateProvider,
  type ApiTemplatePreset,
} from '@/shared/config/config.types';

/** Шаблон API без секретов (ключ никогда не попадает в это представление) */
export type ApiTemplate = {
  id: string;
  /** Уникальное имя шаблона */
  name: string;
  provider: ApiTemplateProvider;
  baseUrl: string;
  model: string;
  createdAt: number;
};

/** Строка таблицы api_templates — snake_case, как в SQLite */
export type ApiTemplateRow = {
  id: string;
  name: string;
  provider: string;
  base_url: string;
  model: string;
  /** Ссылка на ключ в SecureStore (сам ключ в БД не хранится) */
  key_ref: string;
  created_at: number;
};

/** Сообщение в запросе к OpenAI-совместимому API */
export type ChatCompletionMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** Тело POST /chat/completions */
export type ChatCompletionRequest = {
  model: string;
  messages: ChatCompletionMessage[];
  stream: boolean;
};

/** Конфиг запроса к OpenAI-совместимому API */
export type ChatCompletionConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatCompletionMessage[];
};

/** delta внутри SSE-чанка (content отсутствует в финальных чанках) */
export type ChatCompletionChunkDelta = {
  content?: string | null;
};

/** choice внутри SSE-чанка */
export type ChatCompletionChunkChoice = {
  delta?: ChatCompletionChunkDelta;
  finish_reason?: string | null;
};

/** SSE-чанк стримингового ответа /chat/completions */
export type ChatCompletionChunk = {
  choices?: ChatCompletionChunkChoice[];
};

/** Тело ошибки OpenAI-совместимого API */
export type ChatCompletionErrorBody = {
  error?: {
    message?: string;
  };
};

/** Нормализованная ошибка запроса: статус + текст API + частичный текст */
export type ChatCompletionErrorInfo = {
  /** HTTP-статус ответа, если ошибка пришла от сервера */
  status?: number;
  /** Текст ошибки из API (или локальное описание) */
  message: string;
  /** Накопленный до ошибки текст — не теряется */
  partialText: string;
};
