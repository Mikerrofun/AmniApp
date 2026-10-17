import * as Crypto from 'expo-crypto';

import type { ChatRecord, ChatRow } from '@/types/chat';

import { openDb } from './migrations';
import { deleteChatEmbeddings } from './search-repository';

export function mapChatRow(
  row: Pick<
    ChatRow,
    'id' | 'title' | 'is_pinned' | 'created_at' | 'updated_at'
  > &
    Partial<Pick<ChatRow, 'template_id'>>,
): ChatRecord {
  return {
    id: row.id,
    title: row.title,
    isPinned: row.is_pinned === 1,
    templateId: row.template_id ?? null,
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

  return rows.map(mapChatRow);
}

export async function createChat(
  title: string,
  templateId: string | null = null,
): Promise<ChatRecord> {
  const db = await openDb();
  const now = Date.now();
  const chat: ChatRecord = {
    id: Crypto.randomUUID(),
    title,
    isPinned: false,
    templateId,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO chats (id, title, is_pinned, created_at, updated_at, context, template_id)
     VALUES (?, ?, ?, ?, ?, '', ?)`,
    chat.id,
    chat.title,
    chat.isPinned ? 1 : 0,
    chat.createdAt,
    chat.updatedAt,
    chat.templateId,
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
  // Сообщения удаляются каскадом (FK ON DELETE CASCADE),
  // FTS-строка — триггером chats_ad, векторная — вручную
  await db.runAsync('DELETE FROM chats WHERE id = ?', id);
  await deleteChatEmbeddings(id);
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

/** Привязывает шаблон API к чату (updated_at не трогаем — список не перетасовывается) */
export async function setChatTemplate(
  id: string,
  templateId: string | null,
): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    'UPDATE chats SET template_id = ? WHERE id = ?',
    templateId,
    id,
  );
}
