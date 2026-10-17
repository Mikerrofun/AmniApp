import { getEmbeddingsClient } from '@/lib/ai/embeddings';
import { appendToChatContext, updateChatEmbedding } from '@/lib/db';

/**
 * После успешной итерации: склеенный текст (user + assistant) пишется
 * в chats.context — FTS-индекс обновится триггером — и используется
 * для эмбединга контекста (env-ключ, один вектор на итерацию).
 * Fire-and-forget: отсутствие ключа или ошибка тихо пропускаются,
 * keyword-поиск и чат не зависят от этого этапа.
 */
export async function updateChatContextData(
  chatId: string,
  text: string,
): Promise<void> {
  try {
    await appendToChatContext(chatId, text);
  } catch {
    // FTS-контекст обновится при следующей успешной итерации
  }

  try {
    const client = getEmbeddingsClient();

    if (!client) return;

    const vectors = await client.embed([text]);
    const vector = vectors?.[0];

    if (!vector) return;

    await updateChatEmbedding(chatId, 'context', vector);
  } catch {
    // Тихая деградация: повторная попытка при следующей итерации
  }
}
