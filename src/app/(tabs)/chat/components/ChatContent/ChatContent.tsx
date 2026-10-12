import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import { useChatsStore } from "@/features/chats";
import { useT } from "@/shared/i18n";

import type { ChatContentProps } from "./ChatContent.types";
import { ChatInputArea } from "./ChatInputArea";
import { useWebKeyboardInset } from "./useWebKeyboardInset";

/**
 * Контент страницы чата. Поле ввода видно всегда — даже когда чатов
 * еще нет: в этом случае текст идет в глобальный драфт временного
 * чата, а при будущей отправке такой чат будет создан.
 *
 * Клавиатура: на iOS — behavior="padding" (плавный подъем/опускание);
 * на Android — behavior="height", т.к. в edge-to-edge режиме
 * softwareKeyboardLayoutMode: resize не применяется (Expo Go), и окно
 * не ресайзится само; на web клавиатура — оверлей, перекрытие меряем
 * через visualViewport (useWebKeyboardInset).
 */
export function ChatContent({ topInset }: ChatContentProps) {
  const t = useT();
  const keyboardInset = useWebKeyboardInset();
  const activeChat = useChatsStore((state) =>
    state.chats.find((chat) => chat.id === state.activeChatId),
  );

  const behavior =
    Platform.OS === "ios"
      ? "padding"
      : Platform.OS === "android"
        ? "height"
        : undefined;

  return (
    <KeyboardAvoidingView
      behavior={behavior}
      className="flex-1"
      style={{ paddingTop: topInset, paddingBottom: keyboardInset }}
    >
      <View className="flex-1">
        {activeChat ? (
          <>
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
            {/* TODO: здесь будет список сообщений активного чата */}
          </>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-2xl text-text-primary">
              {t("chatInput.emptyTitle")}
            </Text>
            <Text className="pt-2 text-center text-sm text-text-muted">
              {t("chatInput.subtitle")}
            </Text>
          </View>
        )}
      </View>

      <ChatInputArea chatId={activeChat?.id ?? null} />
    </KeyboardAvoidingView>
  );
}
