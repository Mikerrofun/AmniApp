import { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useChatsStore, useGenerationStore } from '@/features/chats';
import { useT } from '@/shared/i18n';

import type { MessageBubbleProps } from './ChatMessages.types';

/**
 * Пузырь сообщения: user справа на акценте, assistant слева на карточке.
 * Стриминговое сообщение показывает растущий текст.
 */
function MessageBubble({ role, text, streaming = false }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <View
      className={
        isUser
          ? 'max-w-[85%] self-end rounded-2xl bg-accent px-3 py-2'
          : 'max-w-[85%] self-start rounded-2xl bg-white/5 px-3 py-2'
      }
    >
      <Text
        className={
          isUser ? 'text-sm text-white' : 'text-sm text-text-primary'
        }
      >
        {text}
        {streaming ? '▍' : ''}
      </Text>
    </View>
  );
}

/**
 * Список сообщений активного чата: notes из БД (по возрастанию),
 * стриминговый ответ ассистента и временное системное сообщение
 * об ошибке (в БД не пишется). Автопрокрутка вниз при обновлениях.
 */
export function ChatMessages() {
  const t = useT();
  const activeChatId = useChatsStore((state) => state.activeChatId);
  const activeNotes = useChatsStore((state) => state.activeNotes);
  const loadChat = useChatsStore((state) => state.loadChat);
  const clearLoadedChat = useChatsStore((state) => state.clearLoadedChat);
  const status = useGenerationStore((state) => state.status);
  const generationChatId = useGenerationStore((state) => state.chatId);
  const streamingText = useGenerationStore((state) => state.streamingText);
  const errorText = useGenerationStore((state) => state.errorText);

  const listRef = useRef<ScrollView>(null);

  // Загрузка контекста при открытии/смене чата. Генерация другого чата
  // сбрасывается — стрим/ошибка не должны показываться в новом чате.
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

  // Стрим/ошибка принадлежат другому чату — в этом чате не показываются
  const isCurrentGeneration =
    activeChatId !== null && generationChatId === activeChatId;
  const showStreaming =
    isCurrentGeneration && status === 'streaming' && streamingText !== '';
  const showError =
    isCurrentGeneration && status === 'error' && errorText !== null;

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [activeNotes.length, streamingText, showError]);

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

      {showStreaming && (
        <MessageBubble role="assistant" text={streamingText} streaming />
      )}

      {showError && (
        <Text className="px-2 py-1 text-center text-xs text-text-muted">
          {t('chatInput.errorPrefix')} {errorText}
        </Text>
      )}
    </ScrollView>
  );
}
