import { Send } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, TextInput, View } from "react-native";

import { useChatDraft, useChatsStore } from "@/features/chats";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import type { ChatInputAreaProps } from "./ChatInputArea.types";

/**
 * Поле ввода активного чата. Текст = черновик чата:
 * запись в БД дебаунсом (~300мс) и по onBlur, переживает
 * перезагрузку и переключение чатов.
 * Кнопка отправки — визуальная (disabled): отправка сообщений не входит
 * в эту итерацию.
 */
export function ChatInputArea({ chat }: ChatInputAreaProps) {
  const t = useT();
  const { draft, handleChange, flush } = useChatDraft(chat);

  const inputRef = useRef<TextInput>(null);
  const focusChatId = useChatsStore((state) => state.focusChatId);
  const consumeFocusChat = useChatsStore((state) => state.consumeFocusChat);

  // Фокус после создания чата (флаг снимается, чтобы не фокусить
  // при обычном переключении чатов)
  useEffect(() => {
    if (focusChatId === chat.id) {
      consumeFocusChat(chat.id);
      inputRef.current?.focus();
    }
  }, [focusChatId, chat.id, consumeFocusChat]);

  return (
    <View className="flex-1 justify-end px-3 pb-3">
      <View className="flex-row items-center gap-2 rounded-[20px] border border-white/10 bg-white/5 p-2">
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={handleChange}
          onBlur={flush}
          multiline
          textAlignVertical="center"
          placeholder={t("chatInput.placeholder")}
          placeholderTextColor={colors.placeholder}
          style={{ paddingTop: 8, paddingBottom: 8 }}
          className="max-h-32 min-h-[36px] flex-1 px-2 text-sm text-text-primary"
        />
        <View className="h-9 w-9 items-center justify-center rounded-[20px] bg-white/5">
          <Pressable
            disabled
            accessibilityRole="button"
            accessibilityLabel={t("chatInput.send")}
            className="h-full w-full items-center justify-center"
          >
            <Send size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
