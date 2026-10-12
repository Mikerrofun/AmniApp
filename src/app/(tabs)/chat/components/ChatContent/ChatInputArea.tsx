import { Send } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, TextInput, View } from "react-native";

import { useChatDraft, useChatsStore } from "@/features/chats";
import {
  ScrollIndicator,
  useScrollIndicator,
} from "@/shared/components/ui/ScrollIndicator";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import type { ChatInputAreaProps } from "./ChatInputArea.types";

/**
 * Поле ввода. Видно всегда — и когда чат выбран, и когда нет
 * (временный чат, chatId = null). Текст = черновик в памяти стора:
 * переживает переключение чатов и вкладок, стирается при рестарте.
 * Кнопка отправки — визуальная (disabled): отправка сообщений не входит
 * в эту итерацию.
 */
export function ChatInputArea({ chatId }: ChatInputAreaProps) {
  const t = useT();
  const { draft, handleChange } = useChatDraft(chatId);

  const inputRef = useRef<TextInput>(null);
  const focusChatId = useChatsStore((state) => state.focusChatId);
  const consumeFocusChat = useChatsStore((state) => state.consumeFocusChat);

  const scroll = useScrollIndicator({ verticalPadding: 4 });

  // Фокус после создания чата (флаг снимается, чтобы не фокусить
  // при обычном переключении чатов)
  useEffect(() => {
    if (chatId !== null && focusChatId === chatId) {
      consumeFocusChat(chatId);
      inputRef.current?.focus();
    }
  }, [focusChatId, chatId, consumeFocusChat]);

  return (
    <View className="px-4 pb-3">
      <View className="flex-row items-center gap-2 rounded-3xl border border-white/10 bg-white/5 p-2">
        <View className="relative min-w-0 flex-1">
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={handleChange}
            multiline
            scrollEnabled
            textAlignVertical="center"
            placeholder={t("chatInput.placeholder")}
            placeholderTextColor={colors.placeholder}
            onScroll={scroll.onScroll}
            onContentSizeChange={scroll.onContentSizeChange}
            onLayout={scroll.onLayout}
            style={{
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 12,
              paddingRight: 8,
              maxHeight: 128,
              minHeight: 36,
            }}
            className="w-full text-sm text-text-primary"
          />
          {/* Индикатор прокрутки слева: видно, сколько текста скрыто */}
          <ScrollIndicator
            isVisible={scroll.isVisible}
            thumbHeight={scroll.thumbHeight}
            thumbTop={scroll.thumbTop}
            side="left"
            inset={1}
          />
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-3xl bg-white/5">
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
