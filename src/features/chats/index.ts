export { useChatsStore } from './model/chats-store';
export type { ChatsState, SortDirection } from './model/chats-store.types';
export { useChats } from './model/use-chats';
export { useCreateChat } from './model/use-create-chat';
export { useChatActions } from './model/use-chat-actions';
export { useChatDraft } from './model/use-chat-draft';
export {
  groupChatsByDay,
  type ChatListSection,
} from './lib/group-chats-by-day';
export { useSearchStore } from './model/search-store';
export type {
  ChatSearchResult,
  ChatSearchSource,
  SearchState,
  TitleMatchRange,
  TitleSegment,
} from './model/search-store.types';
export { useChatSearch } from './model/use-chat-search';
export { mergeSearchResults } from './lib/merge-search-results';
export {
  parseHighlightedTitle,
  splitTitleByRanges,
} from './lib/highlighted-title';
export { cosineSimilarity } from './lib/cosine-similarity';
export { updateTitleEmbedding } from './lib/update-title-embedding';
