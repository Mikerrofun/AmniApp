import { useCallback } from "react";
import { Platform } from "react-native";

import * as Haptics from "expo-haptics";

import { useChatsStore } from "@/features/chats";
import { showToast } from "@/shared/components/ui/Toast";
import { useT } from "@/shared/i18n";

/**
 * Кнопка временного чата: переключение в режим «ничего не выбрано».
 * Вся логика — здесь, компонент только рендерит и вызывает handlePress.
 */
export function useTempChatButton(onCloseSidebar?: () => void) {
  const t = useT();
  const activeChatId = useChatsStore((state) => state.activeChatId);
  const setActiveChat = useChatsStore((state) => state.setActiveChat);
  const requestInputFocus = useChatsStore((state) => state.requestInputFocus);

  const handlePress = useCallback(() => {
    // Легкий тактильный отклик; на web haptics недоступны
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (activeChatId === null) {
      // Уже во временном чате — переключать нечего, только подсказка.
      // Драфт и фокус не трогаем, чтобы не потерять набранный текст
      showToast(t("chats.alreadyInNewChat"));
      return;
    }

    // Текст активного чата остается в его драфте и не теряется
    setActiveChat(null);
    requestInputFocus();
    onCloseSidebar?.();
  }, [t, activeChatId, setActiveChat, requestInputFocus, onCloseSidebar]);

  return { handlePress };
}
