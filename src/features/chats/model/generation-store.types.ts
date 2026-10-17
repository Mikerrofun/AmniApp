/** Состояние генерации ответа */
export type GenerationStatus = 'idle' | 'streaming' | 'error';

export type GenerationState = {
  status: GenerationStatus;
  /** Чат, к которому относится генерация (для показа стрима в нужном чате) */
  chatId: string | null;
  /** Накопленный текст ответа ассистента (растет токен-за-токеном) */
  streamingText: string;
  /**
   * Текст временного системного сообщения об ошибке. В БД не пишется,
   * сбрасывается при следующей отправке или переключении чата.
   */
  errorText: string | null;

  start: (chatId: string) => void;
  /** Принимает накопленный текст (не дельту) */
  appendChunk: (accumulatedText: string) => void;
  fail: (message: string) => void;
  finish: () => void;
  reset: () => void;
};
