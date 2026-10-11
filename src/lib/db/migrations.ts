import * as SQLite from 'expo-sqlite';

import { DB_NAME, DB_SCHEMA_VERSION } from './db.config';
import { setDbStatus } from './db-status';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const version = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const current = version?.user_version ?? 0;

  // v1: базовые таблицы (без draft — черновики живут в памяти, см. v2)
  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    `);
  }

  // v2: колонка draft удалена — черновики это сессионное состояние
  // (аналог sessionStorage), они переехали в память стора
  if (current < 2) {
    const columns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(chats)',
    );

    if (columns.some((column) => column.name === 'draft')) {
      await db.execAsync('ALTER TABLE chats DROP COLUMN draft;');
    }
  }

  await db.execAsync(`PRAGMA user_version = ${DB_SCHEMA_VERSION}`);
}

/**
 * Ленивое открытие БД с применением миграций.
 * Повторные вызовы возвращают тот же промис — открытие происходит один раз.
 */
export function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await migrate(db);
      setDbStatus('ready');

      return db;
    })().catch((error: unknown) => {
      // Сбрасываем промис, чтобы следующая попытка открыла БД заново
      dbPromise = null;
      setDbStatus('error');
      throw error;
    });
  }

  return dbPromise;
}
