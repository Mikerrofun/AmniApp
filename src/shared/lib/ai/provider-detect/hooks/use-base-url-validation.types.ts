/** Статус валидации baseUrl: не начата / endpoint совместим / не совместим */
export type BaseUrlValidationStatus = 'idle' | 'ok' | 'fail';

/** Параметры единого механизма валидации baseUrl формы шаблона */
export type UseBaseUrlValidationParams = {
  apiKey: string;
  /** Текущее значение поля baseUrl формы */
  baseUrl: string;
};

/** Результат валидации baseUrl */
export type UseBaseUrlValidationResult = {
  status: BaseUrlValidationStatus;
  /** Валидированный baseUrl: определенный детектом либо введенный вручную */
  baseUrl: string;
  /**
   * Список моделей доступен через GET /models: false — endpoint прошел
   * только fallback-проверку chat/completions, список не придет и
   * ModelSelect останется в режиме ручного ввода модели
   */
  modelsAvailable: boolean;
};
