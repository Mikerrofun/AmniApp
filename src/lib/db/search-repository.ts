import { SIMILARITY_THRESHOLD } from '@/lib/ai/embeddings';
import type {
  ChatEmbeddingSearchRecord,
  ChatEmbeddingSearchRow,
  ChatKeywordSearchRecord,
  ChatKeywordSearchRow,
} from '@/types/chat';

import { mapChatRow } from './chats-repository';
import { openDb } from './migrations';
import {
  EMBEDDING_SEARCH_LIMIT,
  FTS_HIGHLIGHT_END,
  FTS_HIGHLIGHT_START,
  KEYWORD_SEARCH_LIMIT,
} from './search.config';

/**
 * Собирает FTS5 MATCH-запрос из пользовательской строки: каждый токен
 * становится quoted-фразой (внутренние кавычки удваиваются), спецсимволы
 * FTS-синтаксиса внутри кавычек безопасны.
 *
 * Для токенов от 3 символов добавляется префиксный поиск (`"токен"*`),
 * чтобы «пролист» находил «пролистал» — unicode61 не делает стемминга.
 * Более короткие токены ищутся точно: префикс из 1–2 символов даёт
 * слишком много шума.
 */
const PREFIX_SEARCH_MIN_LENGTH = 3;

function buildFtsMatchQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const quoted = `"${token.replace(/"/g, '""')}"`;

      return token.length >= PREFIX_SEARCH_MIN_LENGTH
        ? `${quoted}*`
        : quoted;
    })
    .join(' ');
}

/**
 * Keyword-поиск по чатам через FTS5 (title + context). Совпадения
 * в title идут первыми, далее — по релевантности (bm25). Поиск по
 * context выполняется тем же запросом: колонка заполняется, когда
 * появится отправка сообщений, и заработает сама.
 */
export async function searchChatsByKeywords(
  query: string,
): Promise<ChatKeywordSearchRecord[]> {
  const trimmed = query.trim();

  if (trimmed === '') return [];

  const db = await openDb();
  const rows = await db.getAllAsync<ChatKeywordSearchRow>(
    `SELECT
       c.id,
       c.title,
       c.is_pinned,
       c.template_id,
       c.created_at,
       c.updated_at,
       highlight(chats_fts, 1, ?, ?) AS highlighted_title
     FROM chats_fts
     JOIN chats c ON c.id = chats_fts.chat_id
     WHERE chats_fts MATCH ?
     ORDER BY
       CASE WHEN instr(highlighted_title, ?) > 0 THEN 0 ELSE 1 END,
       bm25(chats_fts)
     LIMIT ?`,
    [
      FTS_HIGHLIGHT_START,
      FTS_HIGHLIGHT_END,
      buildFtsMatchQuery(trimmed),
      FTS_HIGHLIGHT_START,
      KEYWORD_SEARCH_LIMIT,
    ],
  );

  return rows.map((row) => ({
    chat: mapChatRow(row),
    highlightedTitle: row.highlighted_title,
  }));
}

/**
 * KNN-поиск по эмбедингам чатов (sqlite-vec): сравнение и с
 * title_embedding, и с context_embedding; для чата, найденного
 * обеими колонками, берется лучшая similarity. Пустая таблица или
 * отсутствие расширения — корректный пустой результат.
 */
export async function searchChatsByEmbedding(
  vector: number[],
): Promise<ChatEmbeddingSearchRecord[]> {
  const db = await openDb();
  const best = new Map<string, ChatEmbeddingSearchRecord>();
  const maxDistance = 1 - SIMILARITY_THRESHOLD;

  for (const column of ['title_embedding', 'context_embedding'] as const) {
    let rows: ChatEmbeddingSearchRow[];

    try {
      rows = await db.getAllAsync<ChatEmbeddingSearchRow>(
        `SELECT c.id, c.title, c.is_pinned, c.template_id, c.created_at, c.updated_at,
                v.distance
         FROM chats_vec v
         JOIN chats c ON c.id = v.chat_id
         WHERE v.${column} MATCH ? AND k = ${EMBEDDING_SEARCH_LIMIT}`,
        [JSON.stringify(vector)],
      );
    } catch {
      // Таблицы может не быть (web без sqlite-vec) — этап пропускается
      continue;
    }

    for (const row of rows) {
      if (row.distance > maxDistance) continue;

      const similarity = 1 - row.distance;
      const existing = best.get(row.id);

      if (!existing || similarity > existing.similarity) {
        best.set(row.id, { chat: mapChatRow(row), similarity });
      }
    }
  }

  return [...best.values()].sort((a, b) => b.similarity - a.similarity);
}

/**
 * Записывает эмбединг чата: колонка в chats (JSON-текст) + строка
 * в chats_vec (vec0 триггеров не поддерживает — синхронизация здесь).
 * UPDATE заодно проверяет существование чата: если чат удалили, пока
 * запрос эмбединга был в полете, писать вектор некуда.
 */
export async function updateChatEmbedding(
  chatId: string,
  kind: 'title' | 'context',
  vector: number[],
): Promise<void> {
  const db = await openDb();
  const column =
    kind === 'title' ? 'title_embedding' : 'context_embedding';
  const serialized = JSON.stringify(vector);

  const result = await db.runAsync(
    `UPDATE chats SET ${column} = ? WHERE id = ?`,
    serialized,
    chatId,
  );

  if (result.changes === 0) return;

  // vec0 не принимает частичные вставки надежно — читаем оба вектора
  // из chats и пишем строку целиком (NULL-колонки пропускаем)
  const row = await db.getFirstAsync<{
    title_embedding: string | null;
    context_embedding: string | null;
  }>('SELECT title_embedding, context_embedding FROM chats WHERE id = ?', [
    chatId,
  ]);

  if (!row) return;

  const columns = ['chat_id'];
  const values: (string | number)[] = [chatId];

  if (row.title_embedding !== null) {
    columns.push('title_embedding');
    values.push(row.title_embedding);
  }
  if (row.context_embedding !== null) {
    columns.push('context_embedding');
    values.push(row.context_embedding);
  }

  const placeholders = columns.map(() => '?').join(', ');

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM chats_vec WHERE chat_id = ?', chatId);
    await db.runAsync(
      `INSERT INTO chats_vec (${columns.join(', ')}) VALUES (${placeholders})`,
      values,
    );
  });
}

/** Удаляет векторную строку чата — вызывается из deleteChat */
export async function deleteChatEmbeddings(chatId: string): Promise<void> {
  const db = await openDb();

  try {
    await db.runAsync('DELETE FROM chats_vec WHERE chat_id = ?', chatId);
  } catch {
    // Таблицы может не быть (web без sqlite-vec) — удалять нечего
  }
}
