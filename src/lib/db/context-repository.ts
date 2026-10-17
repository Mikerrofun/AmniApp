import * as Crypto from 'expo-crypto';

import type { ContextRecord, NoteRecord, NoteRole } from '@/types/chat';

import { openDb } from './migrations';

/** Строка notes с джойном на context для фильтрации по чату */
type NoteJoinRow = {
  id: string;
  context_id: string;
  role: string;
  text: string;
  created_at: number;
};

/**
 * Получает существующий контекст чата или создает его.
 * Возвращает id контекста.
 */
export async function ensureContext(chatId: string): Promise<string> {
  const db = await openDb();
  const existing = await db.getFirstAsync<Pick<ContextRecord, 'id'>>(
    'SELECT id FROM context WHERE chat_id = ?',
    chatId,
  );

  if (existing) return existing.id;

  const contextId = Crypto.randomUUID();

  await db.runAsync(
    'INSERT INTO context (id, chat_id, created_at) VALUES (?, ?, ?)',
    contextId,
    chatId,
    Date.now(),
  );

  return contextId;
}

/** Добавляет запись контекста (контекст создается при необходимости) */
export async function appendNote(
  chatId: string,
  role: NoteRole,
  text: string,
): Promise<NoteRecord> {
  const db = await openDb();
  const contextId = await ensureContext(chatId);
  const note: NoteRecord = {
    id: Crypto.randomUUID(),
    contextId,
    role,
    text,
    createdAt: Date.now(),
  };

  await db.runAsync(
    `INSERT INTO notes (id, context_id, role, text, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    note.id,
    note.contextId,
    note.role,
    note.text,
    note.createdAt,
  );

  return note;
}

/**
 * Все notes чата по возрастанию created_at (старые первыми) — это и есть
 * контекст для API и для loadChat. rowid — тай-брейк для записей,
 * созданных в одну миллисекунду.
 */
export async function getNotes(chatId: string): Promise<NoteRecord[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<NoteJoinRow>(
    `SELECT n.id, n.context_id, n.role, n.text, n.created_at
     FROM notes n
     JOIN context c ON c.id = n.context_id
     WHERE c.chat_id = ?
     ORDER BY n.created_at ASC, n.rowid ASC`,
    chatId,
  );

  return rows.map((row) => ({
    id: row.id,
    contextId: row.context_id,
    role: row.role as NoteRole,
    text: row.text,
    createdAt: row.created_at,
  }));
}

/**
 * Дописывает текст в денормализованный chats.context — триггеры
 * chats_au сами обновят FTS-индекс (существующий механизм
 * search-repository).
 */
export async function appendToChatContext(
  chatId: string,
  text: string,
): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    'UPDATE chats SET context = context || ? WHERE id = ?',
    ` ${text}`,
    chatId,
  );
}
