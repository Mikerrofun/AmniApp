// Local persistence layer for conversations, context and API templates.
//
// expo-sqlite with a small repository API (chats, context/notes,
// api_templates) so the UI never touches SQL directly and a future sync
// backend can implement the same interface.

export { openDb } from './migrations';
export { getDbStatus, setDbStatus } from './db-status';
export type { DbStatus } from './db-status';

export {
  listChats,
  createChat,
  renameChat,
  deleteChat,
  setPinned,
  setChatTemplate,
} from './chats-repository';

export {
  ensureContext,
  appendNote,
  getNotes,
  appendToChatContext,
} from './context-repository';

export {
  listTemplates,
  getTemplate,
  createTemplate,
  deleteTemplate,
  getTemplateKey,
  getTemplateForChat,
} from './templates-repository';

export {
  searchChatsByKeywords,
  searchChatsByEmbedding,
  updateChatEmbedding,
  deleteChatEmbeddings,
} from './search-repository';

export type {
  ChatRecord,
  ContextRecord,
  NoteRecord,
  NoteRole,
} from '@/types/chat';
export type {
  ChatEmbeddingKind,
  ChatEmbeddingSearchRecord,
  ChatKeywordSearchRecord,
} from '@/types/chat';
export type { ApiTemplate } from '@/types/api-template';
