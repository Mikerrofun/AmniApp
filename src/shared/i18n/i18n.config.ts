/**
 * Конфигурация i18n
 * Структура повторяет конфиг next-intl: список локалей, дефолт, тип Locale
 */

export const locales = ['ru', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ru';
