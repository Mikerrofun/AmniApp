import { getEmbeddingsClient } from '@/lib/ai/embeddings';
import { updateChatEmbedding } from '@/lib/db';

/**
 * Перегенерирует title_embedding чата. Вызывается при rename.
 * Fire-and-forget: отсутствие ключа
 * в env или ошибка запроса тихо пропускаются, колонка остается
 * NULL/старой до следующей попытки; keyword-поиск не затрагивается.
 */
export async function updateTitleEmbedding(
  chatId: string,
  title: string,
): Promise<void> {
  try {
    const client = getEmbeddingsClient();

    if (!client) return;

    const vectors = await client.embed([title]);
    const vector = vectors?.[0];

    if (!vector) return;

    await updateChatEmbedding(chatId, 'title', vector);
  } catch {
    // Тихая деградация: повторная попытка при следующем rename
  }
}
