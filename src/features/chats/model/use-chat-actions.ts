import { useCallback } from 'react';

import type { ChatRecord } from '@/types/chat';

import { updateTitleEmbedding } from '../lib/update-title-embedding';
import { useChatsStore } from './chats-store';

/**
 * Действия над отдельным чатом: переименование, гвоздик, удаление.
 */
export function useChatActions() {
  const renameChat = useChatsStore((state) => state.renameChat);
  const setPinned = useChatsStore((state) => state.setPinned);
  const deleteChat = useChatsStore((state) => state.deleteChat);

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

  return { renameChat: handleRename, togglePin: handleTogglePin, deleteChat: handleDelete };
}
