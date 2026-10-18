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
   * Отправка сообщения. chatId === null — временный чат: он
   * инициализируется при отправке (id + title-заглушка) до запроса,
   * независимо от результата.
   */
  const sendMessage = useCallback(
    async (chatId: string | null, text: string) => {
      const trimmed = text.trim();

      if (trimmed === '') return;

      // Повторная отправка во время стриминга заблокирована
      if (useGenerationStore.getState().status === 'streaming') return;

      const chatsState = useChatsStore.getState();
      const templateId = chatId
        ? (chatsState.chats.find((chat) => chat.id === chatId)?.templateId ??
          null)
        : chatsState.tempTemplateId;

      if (!templateId) {
        showToast(t('chatInput.selectTemplate'));
        return;
      }

      const template = await getTemplate(templateId);

      if (!template) {
        showToast(t('chatInput.templateMissing'));
        return;
      }

      // Ключ читается из SecureStore только в момент отправки
      const apiKey = await getTemplateKey(template.id);

      if (!apiKey) {
        showToast(t('chatInput.templateKeyMissing'));
        return;
      }

      // Сообщение реально уходит этим шаблоном — запоминаем его
      // как «последний используемый» (in-memory, как drafts)
      useChatsStore.getState().setLastTemplateId(templateId);

      let targetChatId = chatId;

      if (targetChatId === null) {
        const chat = await initTempChat(
          t('chats.newChatDefaultTitle'),
          templateId,
        );
        targetChatId = chat.id;
      } else {
        // Текст уходит — черновик очищается сразу
        setDraft(targetChatId, '');
      }

      // Сообщение юзера: в БД и сразу в UI
      const userNote = await appendNote(targetChatId, 'user', trimmed);

      if (useChatsStore.getState().activeChatId === targetChatId) {
        appendLocalNote(userNote);
      }

      // Контекст = все notes чата по возрастанию (включая новое сообщение)
      const notes = await getNotes(targetChatId);
      const messages = notes.map((note) => ({
        role: note.role,
        content: note.text,
      }));

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

        const assistantNote = await appendNote(
          targetChatId,
          'assistant',
          fullText,
        );

        if (useChatsStore.getState().activeChatId === targetChatId) {
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

        // Ничего не пишем в notes/context/эмбеддинги: тост + временное
        // системное сообщение в чате (в БД не попадает)
        useGenerationStore.getState().fail(message);
        showToast(message);
      }
    },
    [appendLocalNote, initTempChat, setDraft, t],
  );

  return {
    renameChat: handleRename,
    togglePin: handleTogglePin,
    deleteChat: handleDelete,
    sendMessage,
  };
}
