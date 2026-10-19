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
   * Отправка сообщения. Оптимистичный UI: сообщение юзера показывается
   * сразу, в БД ничего не пишется до успешного стрима. Временный чат
   * создается тоже только после успеха — неудачная отправка не оставляет
   * следов ни в БД, ни в списке чатов.
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

      const rollbackUi = () => {
        useGenerationStore.getState().setPendingUser(null);
        // Текст возвращается в инпут — отправку можно повторить
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

      // Сообщение реально уходит этим шаблоном — запоминаем его
      // как «последний используемый» (in-memory, как drafts)
      useChatsStore.getState().setLastTemplateId(templateId);

      // Текст уходит — черновик очищается сразу
      if (chatId === null) {
        setGlobalDraft('');
      } else {
        setDraft(chatId, '');
      }

      // История для запроса: notes из БД + новое сообщение из памяти
      // (в БД оно попадет только после успешного стрима)
      const notes = chatId === null ? [] : await getNotes(chatId);
      const messages = [
        ...notes.map((note) => ({ role: note.role, content: note.text })),
        { role: 'user' as const, content: trimmed },
      ];

      // chatId null — генерация для временного чата (его еще нет в БД)
      useGenerationStore.getState().start(chatId);

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

        // Успех: только теперь создаем временный чат и пишем обе notes
        let targetChatId = chatId;

        if (targetChatId === null) {
          const chat = await initTempChat(
            t('chats.newChatDefaultTitle'),
            templateId,
          );
          targetChatId = chat.id;
        }

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

        // Ничего не пишем в notes/context/эмбеддинги: оптимистичное
        // сообщение откатывается, тост + временное сообщение об ошибке
        useGenerationStore.getState().fail(message);
        rollbackUi();
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
