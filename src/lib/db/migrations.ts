import * as SQLite from 'expo-sqlite';

import { DB_NAME, DB_SCHEMA_VERSION } from './db.config';
import { setDbStatus } from './db-status';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      draft TEXT,
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
