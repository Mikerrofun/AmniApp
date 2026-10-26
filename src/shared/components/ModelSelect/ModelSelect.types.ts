/** Пропсы переиспользуемого селекта модели */
export type ModelSelectProps = {
  /** Base URL провайдера (контракт переиспользования, запрос делает стор) */
  baseUrl: string;
  /** Провайдер — часть ключа кэша моделей */
  provider: string;
  /** Ключ провайдера — часть ключа кэша моделей */
  apiKey: string;
  /** Текущее значение модели формы */
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
};
