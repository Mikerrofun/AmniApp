export type ChatInputAreaProps = {
  /**
   * Активный чат — черновик берется из памяти стора по id.
   * null — временный чат (ничего не выбрано): текст идет
   * в глобальный драфт.
   */
  chatId: string | null;
};
