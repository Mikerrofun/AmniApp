import { useCallback, useState } from 'react';

import { useT } from '@/shared/i18n';

import { updateTitleEmbedding } from '../lib/update-title-embedding';
import { useChatsStore } from './chats-store';

/**
 * Создание чата: пишет в БД, делает чат активным и запрашивает
 * фокус на поле ввода. Название до переименования — i18n-дефолт.
 */
export function useCreateChat() {
  const t = useT();
  const createChat = useChatsStore((state) => state.createChat);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (isCreating) return;

    setIsCreating(true);

    try {
      const chat = await createChat(t('chats.newChatDefaultTitle'));

      // Эмбединг названия — fire-and-forget, UI не блокируется
      void updateTitleEmbedding(chat.id, chat.title);
    } finally {
      setIsCreating(false);
    }
  }, [createChat, isCreating, t]);

  return { createChat: handleCreate, isCreating };
}
