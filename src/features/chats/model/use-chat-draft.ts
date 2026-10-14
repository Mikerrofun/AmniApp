import { useCallback } from 'react';

import { useChatsStore } from './chats-store';

/**
 * Черновик поля ввода. Живет только в памяти (сессионное состояние,
 * аналог sessionStorage): переживает переключение чатов и вкладок,
 * стирается при рестарте приложения.
 *
 * chatId === null — временный чат (ничего не выбрано): текст идет
 * в глобальный драфт. При создании реального чата глобальный драфт
 * стирается, вернуться к временному чату невозможно. Временный чат
 * становится реальным при первой отправке — в будущей итерации.
 */
export function useChatDraft(chatId: string | null) {
  const draft = useChatsStore((state) =>
    chatId === null
      ? state.globalDraft
      : (state.drafts[chatId] ?? ''),
  );
  const setDraft = useChatsStore((state) => state.setDraft);
  const setGlobalDraft = useChatsStore((state) => state.setGlobalDraft);

  const handleChange = useCallback(
    (text: string) => {
      if (chatId === null) {
        setGlobalDraft(text);
      } else {
        setDraft(chatId, text);
      }
    },
    [chatId, setDraft, setGlobalDraft],
  );

  return { draft, handleChange };
}
