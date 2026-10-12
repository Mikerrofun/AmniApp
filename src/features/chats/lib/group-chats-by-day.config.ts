import type { Locale } from '@/shared/i18n';

/**
 * Формат даты в заголовке дневной группы, по локали.
 * Текущий год: ru «11 окт», en «Oct 11».
 */
export const DAY_GROUP_DATE_OPTIONS: Record<
  Locale,
  Intl.DateTimeFormatOptions
> = {
  ru: { day: 'numeric', month: 'short' },
  en: { month: 'short', day: 'numeric' },
};

/** Прошлые годы: год добавляется в конец — ru «11 окт 2025», en «Oct 11, 2025» */
export const DAY_GROUP_DATE_WITH_YEAR_OPTIONS: Record<
  Locale,
  Intl.DateTimeFormatOptions
> = {
  ru: { day: 'numeric', month: 'short', year: 'numeric' },
  en: { month: 'short', day: 'numeric', year: 'numeric' },
};
