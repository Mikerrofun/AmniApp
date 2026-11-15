/** Пропсы переиспользуемого селекта модели */
export type ModelSelectProps = {
  /** Base URL провайдера — часть ключа кэша моделей (запрос делает стор) */
  baseUrl: string;
  /** Ключ провайдера — часть ключа кэша моделей */
  apiKey: string;
  /** Текущее значение модели формы */
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
};
