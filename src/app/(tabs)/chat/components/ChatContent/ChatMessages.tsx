import { useEffect, useRef } from "react";
import { ScrollView, Text, View } from "react-native";

import { useChatsStore, useGenerationStore } from "@/features/chats";
import { useT } from "@/shared/i18n";

import type { MessageBubbleProps } from "./ChatMessages.types";

function MessageBubble({ role, text, streaming = false }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <View
      className={
        isUser
          ? "max-w-[85%] self-end rounded-2xl bg-accent px-3 py-2"
          : "max-w-[85%] self-start rounded-2xl bg-white/5 px-3 py-2"
      }
    >
      <Text
        className={isUser ? "text-sm text-white" : "text-sm text-text-primary"}
      >
        {text}
        {streaming ? "▍" : ""}
      </Text>
    </View>
  );
}

/**
 * Список сообщений активного чата: notes из БД (по возрастанию)
 */
export function ChatMessages() {
  const t = useT();
  const activeChatId = useChatsStore((state) => state.activeChatId);
  const activeNotes = useChatsStore((state) => state.activeNotes);
  const loadChat = useChatsStore((state) => state.loadChat);
  const clearLoadedChat = useChatsStore((state) => state.clearLoadedChat);
  const status = useGenerationStore((state) => state.status);
  const generationChatId = useGenerationStore((state) => state.chatId);
  const pendingUserText = useGenerationStore(
    (state) => state.pendingUserText,
  );
  const streamingText = useGenerationStore((state) => state.streamingText);
  const errorText = useGenerationStore((state) => state.errorText);

  const listRef = useRef<ScrollView>(null);

  useEffect(() => {
    const generation = useGenerationStore.getState();

    if (generation.chatId !== activeChatId) {
      generation.reset();
    }

    if (activeChatId === null) {
      clearLoadedChat();
      return;
    }

    void loadChat(activeChatId);
  }, [activeChatId, loadChat, clearLoadedChat]);

  // null === null — генерация для временного чата (его еще нет в БД)
  const isCurrentGeneration = generationChatId === activeChatId;
  const showPending =
    isCurrentGeneration && status !== "error" && pendingUserText !== null;
  const showStreaming =
    isCurrentGeneration && status === "streaming" && streamingText !== "";
  const showError =
    isCurrentGeneration && status === "error" && errorText !== null;

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [activeNotes.length, showPending, streamingText, showError]);

  return (
    <ScrollView
      ref={listRef}
      className="flex-1"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
        gap: 8,
      }}
    >
      {activeNotes.map((note) => (
        <MessageBubble key={note.id} role={note.role} text={note.text} />
      ))}

      {/* Оптимистичное сообщение юзера: в БД попадет только при успехе */}
      {showPending && (
        <MessageBubble role="user" text={pendingUserText ?? ""} />
      )}

      {showStreaming && (
        <MessageBubble role="assistant" text={streamingText} streaming />
      )}

      {showError && (
        <Text className="px-2 py-1 text-center text-xs text-text-muted">
          {t("chatInput.errorPrefix")} {errorText}
        </Text>
      )}
    </ScrollView>
  );
}
