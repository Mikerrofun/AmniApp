/** Состояние генерации ответа */
export type GenerationStatus = 'idle' | 'streaming' | 'error';

export type GenerationState = {
  status: GenerationStatus;
  /**
   * Чат, к которому относится генерация. null — временный чат:
   * он создается в БД только после успешного стрима.
   */
  chatId: string | null;
  /**
   * Оптимистичное сообщение юзера: показывается в UI сразу при
   * отправке, в БД попадает только при успехе (вместе с ответом).
   */
  pendingUserText: string | null;
  /** Накопленный текст ответа ассистента (растет токен-за-токеном) */
  streamingText: string;
  /**
   * Текст временного системного сообщения об ошибке. В БД не пишется,
   * сбрасывается при следующей отправке или переключении чата.
   */
  errorText: string | null;

  /** Оптимистичное сообщение юзера (сразу при отправке, до валидации) */
  setPendingUser: (text: string | null) => void;
  start: (chatId: string | null) => void;
  /** Принимает накопленный текст (не дельту) */
  appendChunk: (accumulatedText: string) => void;
  /** Ошибка: оптимистичное сообщение откатывается из UI */
  fail: (message: string) => void;
  /** Сбрасывает только плашку ошибки (уход из чата); стрим не трогает */
  clearError: () => void;
  finish: () => void;
  reset: () => void;
};
