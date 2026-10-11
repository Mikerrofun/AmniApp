import { useEffect, useRef } from 'react';

import { useChatsStore } from './chats-store';

/**
 * Список чатов. Загружает данные из БД при монтировании чат-экрана.
 */
export function useChats() {
  const chats = useChatsStore((state) => state.chats);
  const isLoading = useChatsStore((state) => state.isLoading);
  const loadChats = useChatsStore((state) => state.loadChats);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void loadChats();
  }, [loadChats]);

  return { chats, isLoading };
}
