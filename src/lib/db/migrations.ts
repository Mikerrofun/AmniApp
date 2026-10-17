import * as SQLite from 'expo-sqlite';

import { EMBEDDING_DIMENSIONS } from '@/lib/ai/embeddings';

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

  // v3: поиск по чатам — денормализованный context, FTS5-индекс
  // (title + context) с триггерами синхронизации и векторная таблица
  // sqlite-vec для embedding-поиска
  if (current < 3) {
    const columns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(chats)',
    );
    const hasColumn = (name: string) =>
      columns.some((column) => column.name === name);

    if (!hasColumn('context')) {
      await db.execAsync(
        "ALTER TABLE chats ADD COLUMN context TEXT NOT NULL DEFAULT '';",
      );
    }
    if (!hasColumn('title_embedding')) {
      await db.execAsync(
        'ALTER TABLE chats ADD COLUMN title_embedding TEXT;',
      );
    }
    if (!hasColumn('context_embedding')) {
      await db.execAsync(
        'ALTER TABLE chats ADD COLUMN context_embedding TEXT;',
      );
    }

    // FTS5-таблица обычная (не external-content): у chats нет
    // rowid-совместимого INTEGER PRIMARY KEY, chat_id хранится
    // UNINDEXED-колонкой, триггеры поддерживают индекс актуальным
    await db.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chats_fts USING fts5(
        chat_id UNINDEXED,
        title,
        context
      );

      CREATE TRIGGER IF NOT EXISTS chats_ai AFTER INSERT ON chats BEGIN
        INSERT INTO chats_fts (chat_id, title, context)
        VALUES (new.id, new.title, new.context);
      END;

      CREATE TRIGGER IF NOT EXISTS chats_ad AFTER DELETE ON chats BEGIN
        DELETE FROM chats_fts WHERE chat_id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS chats_au
        AFTER UPDATE OF title, context ON chats BEGIN
        DELETE FROM chats_fts WHERE chat_id = old.id;
        INSERT INTO chats_fts (chat_id, title, context)
        VALUES (new.id, new.title, new.context);
      END;

      INSERT INTO chats_fts (chat_id, title, context)
      SELECT id, title, context FROM chats
      WHERE id NOT IN (SELECT chat_id FROM chats_fts);
    `);

    // Векторная таблица vec0 триггеров не поддерживает — синхронизация
    // из репозитория (updateChatEmbedding / deleteChat). На платформах
    // без расширения (web) создание тихо пропускается: embedding-поиск
    // недоступен, keyword-поиск продолжает работать.
    try {
      await db.execAsync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS chats_vec USING vec0(
          chat_id TEXT PRIMARY KEY,
          title_embedding float[${EMBEDDING_DIMENSIONS}],
          context_embedding float[${EMBEDDING_DIMENSIONS}]
        );
      `);
    } catch {
      // sqlite-vec недоступен — см. комментарий выше
    }
  }

  // v4: контекст чата переходит на модель context/notes (одна строка
  // context = один контекст чата, записи контекста живут в notes),
  // добавляются шаблоны API и привязка шаблона к чату. Таблица messages
  // дропается — приложение в dev, данных в ней нет.
  if (current < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS context (
        id TEXT PRIMARY KEY NOT NULL,
        chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        context_id TEXT NOT NULL REFERENCES context(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      DROP TABLE IF EXISTS messages;

      CREATE TABLE IF NOT EXISTS api_templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL,
        base_url TEXT NOT NULL,
        model TEXT NOT NULL,
        key_ref TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_context_chat_id ON context(chat_id);
      CREATE INDEX IF NOT EXISTS idx_notes_context_id ON notes(context_id);
    `);

    const chatColumns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(chats)',
    );

    if (!chatColumns.some((column) => column.name === 'template_id')) {
      await db.execAsync('ALTER TABLE chats ADD COLUMN template_id TEXT;');
    }
  }

  await db.execAsync(`PRAGMA user_version = ${DB_SCHEMA_VERSION}`);
}

/**
 * Загружает bundled-расширение sqlite-vec до миграций: без него
 * векторная таблица chats_vec не создастся. На платформах без
 * поддержки расширений (web) тихо пропускается.
 */
async function loadVecExtension(db: SQLite.SQLiteDatabase): Promise<void> {
  const extension = SQLite.bundledExtensions['sqlite-vec'];

  if (!extension) return;

  try {
    await db.loadExtensionAsync(extension.libPath, extension.entryPoint);
  } catch {
    // Расширение не загрузилось — миграция создаст схему без chats_vec
  }
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
      await loadVecExtension(db);
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
