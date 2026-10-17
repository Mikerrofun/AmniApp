import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { API_TEMPLATE_PRESETS } from '@/types/api-template';
import type {
  ApiTemplate,
  ApiTemplateProvider,
  ApiTemplateRow,
} from '@/types/api-template';

import { openDb } from './migrations';

/** Префикс ключей SecureStore: в БД хранится только key_ref */
const KEY_PREFIX = 'template-key:';

function mapTemplateRow(row: ApiTemplateRow): ApiTemplate {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as ApiTemplateProvider,
    baseUrl: row.base_url,
    model: row.model,
    createdAt: row.created_at,
  };
}

/** Все шаблоны, старые сверху */
export async function listTemplates(): Promise<ApiTemplate[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<ApiTemplateRow>(
    'SELECT * FROM api_templates ORDER BY created_at ASC',
  );

  return rows.map(mapTemplateRow);
}

/** Один шаблон по id; null — не найден */
export async function getTemplate(
  templateId: string,
): Promise<ApiTemplate | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<ApiTemplateRow>(
    'SELECT * FROM api_templates WHERE id = ?',
    templateId,
  );

  return row ? mapTemplateRow(row) : null;
}

/**
 * Создает шаблон: ключ пишется в SecureStore под `template-key:<id>`,
 * в БД — только key_ref. При ошибке вставки (например, дубликат имени)
 * ключ удаляется, чтобы не оставлять мусор в SecureStore.
 */
export async function createTemplate(
  name: string,
  provider: ApiTemplateProvider,
  model: string,
  apiKey: string,
): Promise<ApiTemplate> {
  const id = Crypto.randomUUID();
  const keyRef = `${KEY_PREFIX}${id}`;
  const baseUrl = API_TEMPLATE_PRESETS[provider].baseUrl;

  await SecureStore.setItemAsync(keyRef, apiKey);

  try {
    const db = await openDb();
    await db.runAsync(
      `INSERT INTO api_templates (id, name, provider, base_url, model, key_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      name,
      provider,
      baseUrl,
      model,
      keyRef,
      Date.now(),
    );
  } catch (error: unknown) {
    await SecureStore.deleteItemAsync(keyRef);
    throw error;
  }

  return {
    id,
    name,
    provider,
    baseUrl,
    model,
    createdAt: Date.now(),
  };
}

/** Удаляет шаблон вместе с ключом из SecureStore */
export async function deleteTemplate(templateId: string): Promise<void> {
  const db = await openDb();
  const row = await db.getFirstAsync<Pick<ApiTemplateRow, 'key_ref'>>(
    'SELECT key_ref FROM api_templates WHERE id = ?',
    templateId,
  );

  await db.runAsync('DELETE FROM api_templates WHERE id = ?', templateId);

  if (row) {
    await SecureStore.deleteItemAsync(row.key_ref);
  }
}

/**
 * Читает ключ шаблона из SecureStore по key_ref. Вызывается только
 * в момент отправки — ключ не кэшируется в сторах.
 */
export async function getTemplateKey(
  templateId: string,
): Promise<string | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<Pick<ApiTemplateRow, 'key_ref'>>(
    'SELECT key_ref FROM api_templates WHERE id = ?',
    templateId,
  );

  if (!row) return null;

  return SecureStore.getItemAsync(row.key_ref);
}

/** Шаблон, привязанный к чату (джойн через chats.template_id) */
export async function getTemplateForChat(
  chatId: string,
): Promise<ApiTemplate | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<ApiTemplateRow>(
    `SELECT t.*
     FROM chats c
     JOIN api_templates t ON t.id = c.template_id
     WHERE c.id = ?`,
    chatId,
  );

  return row ? mapTemplateRow(row) : null;
}
