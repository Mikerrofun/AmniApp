import { useCallback } from 'react';

import { ChatCompletionError, streamChatCompletion } from '@/lib/ai/openai-compat-client';
import {
  appendNote,
  getNotes,
  getTemplate,
  getTemplateKey,
} from '@/lib/db';
import { showToast } from '@/shared/components/ui/Toast';
import { useT } from '@/shared/i18n';

import type { ChatRecord } from '@/types/chat';

import { updateChatContextData } from '../lib/update-context-embedding';
import { updateTitleEmbedding } from '../lib/update-title-embedding';
import { useChatsStore } from './chats-store';
import { useGenerationStore } from './generation-store';

/**
 * Действия над отдельным чатом: переименование, гвоздик, удаление,
 * отправка сообщения (полный флоу: инициализация временного чата,
 * notes, стриминг, эмбеддинг).
 */
export function useChatActions() {
  const t = useT();
  const renameChat = useChatsStore((state) => state.renameChat);
  const setPinned = useChatsStore((state) => state.setPinned);
  const deleteChat = useChatsStore((state) => state.deleteChat);
  const setDraft = useChatsStore((state) => state.setDraft);
  const setGlobalDraft = useChatsStore((state) => state.setGlobalDraft);
  const initTempChat = useChatsStore((state) => state.initTempChat);
  const appendLocalNote = useChatsStore((state) => state.appendLocalNote);

  const handleRename = useCallback(
    (id: string, title: string) => {
      // Эмбединг названия перегенерируется после успешного rename,
      // fire-and-forget: без ключа/при ошибке тихо пропускается
      void renameChat(id, title).then(() => updateTitleEmbedding(id, title));
    },
    [renameChat],
  );

  const handleTogglePin = useCallback(
    (chat: ChatRecord) => setPinned(chat.id, !chat.isPinned),
    [setPinned],
  );

  const handleDelete = useCallback(
    (id: string) => deleteChat(id),
    [deleteChat],
  );

  /**
   * Отправка сообщения. Оптимистичный UI: пузырь юзера сразу, notes
   * пишутся только после успешного стрима. Временный чат создается
   * сразу при отправке (после валидации) — к нему можно вернуться из
   * списка как к обычному чату; стрим переживает переключение чатов.
   */
  const sendMessage = useCallback(
    async (chatId: string | null, text: string) => {
      const trimmed = text.trim();

      if (trimmed === '') return;

      const generation = useGenerationStore.getState();

      // Повторная отправка во время стриминга или ожидания заблокирована
      if (
        generation.status === 'streaming' ||
        generation.pendingUserText !== null
      ) {
        return;
      }

      // Оптимистичное сообщение юзера — в UI мгновенно
      generation.setPendingUser(trimmed);

      // Откат до создания чата: пузырь убирается, текст в инпут
      const rollbackUi = () => {
        useGenerationStore.getState().setPendingUser(null);

        if (chatId === null) {
          if (useChatsStore.getState().activeChatId === null) {
            setGlobalDraft(trimmed);
          }
        } else {
          setDraft(chatId, trimmed);
        }
      };

      const chatsState = useChatsStore.getState();
      // У временного чата нет своего шаблона — используется последний
      const templateId = chatId
        ? (chatsState.chats.find((chat) => chat.id === chatId)?.templateId ??
          null)
        : chatsState.lastTemplateId;

      if (!templateId) {
        rollbackUi();
        showToast(t('chatInput.selectTemplate'));
        return;
      }

      const template = await getTemplate(templateId);

      if (!template) {
        rollbackUi();
        showToast(t('chatInput.templateMissing'));
        return;
      }

      // Ключ читается из SecureStore только в момент отправки
      const apiKey = await getTemplateKey(template.id);

      if (!apiKey) {
        rollbackUi();
        showToast(t('chatInput.templateKeyMissing'));
        return;
      }

      // Шаблон использован — запоминаем независимо от исхода запроса
      useChatsStore.getState().setLastTemplateId(templateId);

      // Текст уходит — черновик очищается
      if (chatId === null) {
        setGlobalDraft('');
      } else {
        setDraft(chatId, '');
      }

      // Временный чат становится обычным: создается сразу при отправке
      let targetChatId = chatId;

      if (targetChatId === null) {
        const chat = await initTempChat(
          t('chats.newChatDefaultTitle'),
          templateId,
        );
        targetChatId = chat.id;
      }

      // История: notes из БД + новое сообщение из памяти (в БД после успеха)
      const notes = await getNotes(targetChatId);
      const messages = [
        ...notes.map((note) => ({ role: note.role, content: note.text })),
        { role: 'user' as const, content: trimmed },
      ];

      useGenerationStore.getState().start(targetChatId);

      try {
        const fullText = await streamChatCompletion(
          {
            baseUrl: template.baseUrl,
            apiKey,
            model: template.model,
            messages,
          },
          (accumulated) => useGenerationStore.getState().appendChunk(accumulated),
        );

        const userNote = await appendNote(targetChatId, 'user', trimmed);
        const assistantNote = await appendNote(
          targetChatId,
          'assistant',
          fullText,
        );

        if (useChatsStore.getState().activeChatId === targetChatId) {
          appendLocalNote(userNote);
          appendLocalNote(assistantNote);
        }

        useGenerationStore.getState().finish();

        // Склеенный текст двух сообщений → chats.context (FTS триггером)
        // и context_embedding. Fire-and-forget.
        void updateChatContextData(
          targetChatId,
          `${trimmed} ${fullText}`,
        );
      } catch (error: unknown) {
        const message =
          error instanceof ChatCompletionError
            ? error.message
            : t('chatInput.requestFailed');

        // notes/context/эмбеддинги не пишутся; текст юзера возвращается
        // в draft созданного чата, плашка ошибки живет до ухода из чата
        useGenerationStore.getState().fail(message);
        setDraft(targetChatId, trimmed);
        showToast(message);
      }
    },
    [appendLocalNote, initTempChat, setDraft, setGlobalDraft, t],
  );

  return {
    renameChat: handleRename,
    togglePin: handleTogglePin,
    deleteChat: handleDelete,
    sendMessage,
  };
}
