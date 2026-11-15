/** Статус валидации baseUrl: не начата / endpoint совместим / не совместим */
export type BaseUrlValidationStatus = 'idle' | 'ok' | 'fail';

/** Параметры единого механизма валидации baseUrl формы шаблона */
export type UseBaseUrlValidationParams = {
  /**
   * auto — baseUrl берется из детекта провайдера по префиксу ключа
   * (useProviderDetect); manual — обязательный probe введенного вручную
   * baseUrl через fetchAvailableModels.
   */
  mode: 'auto' | 'manual';
  apiKey: string;
  /** Ручной baseUrl; используется только в mode: 'manual' */
  manualBaseUrl?: string;
};

/** Результат валидации baseUrl */
export type UseBaseUrlValidationResult = {
  status: BaseUrlValidationStatus;
  /** Валидированный baseUrl: определенный детектом либо введенный вручную */
  baseUrl: string;
};
