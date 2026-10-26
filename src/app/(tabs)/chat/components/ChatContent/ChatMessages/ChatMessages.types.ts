import type { NoteRole } from '@/types/chat';

/** Пузырь сообщения контекста */
export type MessageBubbleProps = {
  role: NoteRole;
  text: string;
  /** Стриминговое сообщение — текст растет токен-за-токеном */
  streaming?: boolean;
};
