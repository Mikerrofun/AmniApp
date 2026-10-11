import * as Crypto from 'expo-crypto';

import type { ChatRecord, ChatRow } from '@/types/chat';

import { openDb } from './migrations';

function mapRow(row: ChatRow): ChatRecord {
  return {
    id: row.id,
    title: row.title,
    isPinned: row.is_pinned === 1,
    draft: row.draft,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Все чаты, новые сверху */
export async function listChats(): Promise<ChatRecord[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<ChatRow>(
    'SELECT * FROM chats ORDER BY updated_at DESC',
  );

  return rows.map(mapRow);
}

export async function createChat(title: string): Promise<ChatRecord> {
  const db = await openDb();
  const now = Date.now();
  const chat: ChatRecord = {
    id: Crypto.randomUUID(),
    title,
    isPinned: false,
    draft: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO chats (id, title, is_pinned, draft, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    chat.id,
    chat.title,
    chat.isPinned ? 1 : 0,
    chat.draft,
    chat.createdAt,
    chat.updatedAt,
  );

  return chat;
}

export async function renameChat(id: string, title: string): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    'UPDATE chats SET title = ?, updated_at = ? WHERE id = ?',
    title,
    Date.now(),
    id,
  );
}

export async function deleteChat(id: string): Promise<void> {
  const db = await openDb();
  // Сообщения удаляются каскадом (FK ON DELETE CASCADE)
  await db.runAsync('DELETE FROM chats WHERE id = ?', id);
}

export async function setPinned(
  id: string,
  isPinned: boolean,
): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    'UPDATE chats SET is_pinned = ? WHERE id = ?',
    isPinned ? 1 : 0,
    id,
  );
}

/**
 * Сохраняет черновик. updated_at намеренно не меняется:
 * набор текста не должен поднимать чат в списке.
 */
export async function updateDraft(
  id: string,
  draft: string,
): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    'UPDATE chats SET draft = ? WHERE id = ?',
    draft.length > 0 ? draft : null,
    id,
  );
}
