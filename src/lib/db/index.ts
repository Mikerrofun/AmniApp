// Local persistence layer for conversations and messages.
//
// Plan: expo-sqlite with a small repository API (conversations, messages)
// so the UI never touches SQL directly and a future sync backend can
// implement the same interface.

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
};

// Placeholder until the sqlite schema migration lands.
export const dbStatus = 'not-initialized' as const;
