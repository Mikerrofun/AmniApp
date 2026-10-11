import { defaultLocale, type Locale } from './i18n.config';
import messagesEn from './messages/en.json';
import messagesRu from './messages/ru.json';

const dictionaries: Record<Locale, unknown> = {
  ru: messagesRu,
  en: messagesEn,
};

/** Достаёт значение по пути вида "chats.newChat" из вложенного словаря */
function resolve(dict: unknown, key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        acc !== null && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      dict,
    );

  return typeof value === 'string' ? value : undefined;
}

export type Translator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Создает функцию перевода: ищет ключ в словаре локали,
 * при отсутствии — в дефолтной, затем возвращает сам ключ.
 * Подставляет параметры вида {name}.
 */
export function createTranslator(locale: Locale): Translator {
  return (key, params) => {
    const raw =
      resolve(dictionaries[locale], key) ??
      resolve(dictionaries[defaultLocale], key) ??
      key;

    if (!params) return raw;

    return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}
