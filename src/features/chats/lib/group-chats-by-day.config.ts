import type { Locale } from '@/shared/i18n';

/**
 * Формат даты в заголовке дневной группы, по локали.
 * ru: «11.10», en: «Oct 11»
 */
export const DAY_GROUP_DATE_OPTIONS: Record<
  Locale,
  Intl.DateTimeFormatOptions
> = {
  ru: { day: '2-digit', month: '2-digit' },
  en: { month: 'short', day: 'numeric' },
};

/** Разделитель между датой и количеством чатов в заголовке группы */
export const DAY_GROUP_TITLE_SEPARATOR = ' — ';
