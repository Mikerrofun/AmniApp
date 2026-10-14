import { useCallback, useState } from 'react';

import { useT } from '@/shared/i18n';

import { useChatsStore } from './chats-store';

/**
 * Создание чата: пишет в БД, делает чат активным и запрашивает
 * фокус на поле ввода. Название до переименования — i18n-дефолт.
 * Эмбединг названия генерируется только при переименовании.
 */
export function useCreateChat() {
  const t = useT();
  const createChat = useChatsStore((state) => state.createChat);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (isCreating) return;

    setIsCreating(true);

    try {
      await createChat(t('chats.newChatDefaultTitle'));
    } finally {
      setIsCreating(false);
    }
  }, [createChat, isCreating, t]);

  return { createChat: handleCreate, isCreating };
}
