import { useEffect, useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useChatsStore, useGenerationStore } from "@/features/chats";
import { colors } from "@/shared/config/colors";
import {
  ScrollIndicator,
  useScrollIndicator,
} from "@/shared/components/ui/ScrollIndicator";
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

/** Крутящийся кружок: стрим начался, но первый токен еще не пришел */
function LoadingBubble() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
    );
  }, [rotation]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View className="self-start rounded-2xl bg-white/5 px-3 py-2.5">
      <Animated.View
        style={[
          {
            width: 14,
            height: 14,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.15)",
            borderTopColor: colors.accent,
          },
          spinnerStyle,
        ]}
      />
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
  // Автоскролл вниз нужен только пока юзер и так внизу: иначе стрим
  // постоянно дергает список, и прочитать ответ, листая вверх, нельзя
  const isAtBottomRef = useRef(true);
  // Тонкий ползунок прокрутки как в сайдбаре чатов (вместо системного
  // скроллбара)
  const scroll = useScrollIndicator({ verticalPadding: 8 });

  useEffect(() => {
    // Плашка ошибки не переживает смену чата; стрим при этом
    // продолжает жить в фоне — сброса генерации при уходе нет
    const generation = useGenerationStore.getState();

    if (generation.status === 'error') {
      generation.clearError();
    }

    if (activeChatId === null) {
      clearLoadedChat();
      return;
    }

    isAtBottomRef.current = true;
    void loadChat(activeChatId);
  }, [activeChatId, loadChat, clearLoadedChat]);

  const isCurrentGeneration = generationChatId === activeChatId;
  // Оптимистичный пузырь виден и до start() — chatId еще null
  const showPending =
    pendingUserText !== null &&
    status !== 'error' &&
    (isCurrentGeneration || generationChatId === null);
  const showStreaming =
    isCurrentGeneration && status === 'streaming' && streamingText !== '';
  // Стрим идет, но текста еще нет — показываем ожидание, чтобы не выглядело зависшим
  const showLoading =
    isCurrentGeneration && status === 'streaming' && streamingText === '';
  const showError =
    isCurrentGeneration && status === 'error' && errorText !== null;

  useEffect(() => {
    if (isAtBottomRef.current) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [activeNotes.length, showPending, streamingText, showError, showLoading]);

  // Пузыри касаются краев списка: скругленная обрезка — на внутренней
  // обертке, а не на самом ScrollView (overflow-hidden на нем перекрывает
  // его собственный overflow-scroll и ломает прокрутку на web). Внешний
  // View без обрезки — точка позиционирования ползунка: как в сайдбаре,
  // он лежит справа от списка, в зазоре до края панели (inset -6)
  return (
    <View className="mx-4 flex-1">
      <View className="flex-1 overflow-hidden rounded-2xl">
        <ScrollView
          ref={listRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onScroll={(event) => {
            scroll.onScroll(event);

            const { contentOffset, contentSize, layoutMeasurement } =
              event.nativeEvent;
            const distanceFromBottom =
              contentSize.height - layoutMeasurement.height - contentOffset.y;

            isAtBottomRef.current = distanceFromBottom < 48;
          }}
          onContentSizeChange={(width, height) =>
            scroll.onContentSizeChange({
              nativeEvent: { contentSize: { width, height } },
            })
          }
          onLayout={scroll.onLayout}
          scrollEventThrottle={16}
          contentContainerStyle={{
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

          {showLoading && <LoadingBubble />}

          {showStreaming && (
            <MessageBubble role="assistant" text={streamingText} streaming />
          )}

          {showError && (
            <Text className="px-2 py-1 text-center text-xs text-text-muted">
              {t("chatInput.errorPrefix")} {errorText}
            </Text>
          )}
        </ScrollView>
      </View>
      <ScrollIndicator style={scroll.thumbStyle} side="right" inset={-6} />
    </View>
  );
}
