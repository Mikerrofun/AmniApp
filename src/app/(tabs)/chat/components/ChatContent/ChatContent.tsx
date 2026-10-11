import { Text, View } from "react-native";

import { useChatsStore } from "@/features/chats";
import { useT } from "@/shared/i18n";

import { ChatInputArea } from "./ChatInputArea";
import type { ChatContentProps } from "./ChatContent.types";

export function ChatContent({ topInset }: ChatContentProps) {
  const t = useT();
  const activeChat = useChatsStore((state) =>
    state.chats.find((chat) => chat.id === state.activeChatId),
  );

  if (!activeChat) {
    return (
      <View className="flex-1" style={{ paddingTop: topInset }}>
        <Text className="pt-16 text-center text-2xl text-text-primary">
          {t("chatInput.emptyTitle")}
        </Text>
        <Text className="pt-2 text-center text-sm text-text-muted">
          {t("chatInput.subtitle")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ paddingTop: topInset }}>
      <Text
        numberOfLines={1}
        className="px-4 pt-3 text-center text-base font-semibold text-text-primary"
      >
        {activeChat.title}
      </Text>

      {/* key = id чата: при переключении чата компонент пересоздается
          с черновиком этого чата */}
      <ChatInputArea key={activeChat.id} chat={activeChat} />
    </View>
  );
}
