// Local persistence layer for conversations and messages.
//
// expo-sqlite with a small repository API (chats, messages)
// so the UI never touches SQL directly and a future sync backend can
// implement the same interface.

export { openDb } from './migrations';
export { getDbStatus, setDbStatus } from './db-status';
export type { DbStatus } from './db-status';

export {
  listChats,
  createChat,
  renameChat,
  deleteChat,
  setPinned,
  updateDraft,
} from './chats-repository';

export type { ChatRecord, ChatMessageRecord } from '@/types/chat';
