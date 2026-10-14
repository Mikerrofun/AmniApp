import { useCallback } from "react";

import { useChatsStore } from "@/features/chats";

/**
 * Кнопка временного чата: переключение в режим «ничего не выбрано»
 * и очистка того, что можно стереть. Вся логика — здесь, компонент
 * только рендерит и вызывает handlePress.
 */
export function useTempChatButton(onCloseSidebar?: () => void) {
  const activeChatId = useChatsStore((state) => state.activeChatId);
  const setActiveChat = useChatsStore((state) => state.setActiveChat);
  const setGlobalDraft = useChatsStore((state) => state.setGlobalDraft);
  const requestInputFocus = useChatsStore((state) => state.requestInputFocus);

  const handlePress = useCallback(() => {
    if (activeChatId === null) {
      // Уже во временном чате — стираем глобальный драфт
      setGlobalDraft("");
    } else {
      // Текст активного чата остается в его драфте и не теряется
      setActiveChat(null);
    }

    requestInputFocus();
    onCloseSidebar?.();
  }, [
    activeChatId,
    setActiveChat,
    setGlobalDraft,
    requestInputFocus,
    onCloseSidebar,
  ]);

  return { handlePress };
}
