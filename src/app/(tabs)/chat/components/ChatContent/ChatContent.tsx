import { Text, View } from "react-native";

import { useChatsStore } from "@/features/chats";
import { useT } from "@/shared/i18n";

import type { ChatContentProps } from "./ChatContent.types";
import { ChatInputArea } from "./ChatInputArea";

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
      <View className="flex-row items-center px-4" style={{ height: 54 }}>
        <View style={{ width: 54 }} />
        <Text
          numberOfLines={1}
          className="flex-1 text-center text-base font-semibold text-text-primary"
        >
          {activeChat.title}
        </Text>
        <View style={{ width: 54 }} />
      </View>

      <ChatInputArea key={activeChat.id} chat={activeChat} />
    </View>
  );
}
