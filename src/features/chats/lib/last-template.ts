import * as SecureStore from 'expo-secure-store';

/**
 * Глобальный «последний используемый» шаблон API. Живет в SecureStore,
 * поэтому переживает перезапуск приложения: временный чат всегда
 * стартует с этим шаблоном (выбрать другой можно в любой момент).
 *
 * Ключ без двоеточий — expo-secure-store на Android допускает в ключах
 * только буквы, цифры, '.', '-' и '_'.
 */
const LAST_TEMPLATE_KEY = 'last-template-id';

/** Никогда не бросает: хранилище недоступно — шаблон просто не подставится */
export async function loadLastTemplateId(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(LAST_TEMPLATE_KEY)) ?? null;
  } catch {
    return null;
  }
}

/** Ошибка сохранения не критична: выбор останется только на сессию */
export async function saveLastTemplateId(
  templateId: string | null,
): Promise<void> {
  try {
    if (templateId === null) {
      await SecureStore.deleteItemAsync(LAST_TEMPLATE_KEY);
    } else {
      await SecureStore.setItemAsync(LAST_TEMPLATE_KEY, templateId);
    }
  } catch {
    // Игнорируем: персист — best effort
  }
}
