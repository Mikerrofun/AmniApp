import type { ChatRecord } from '@/types/chat';
import type { Locale } from '@/shared/i18n';

import type { SortDirection } from '../model/chats-store.types';

import {
  DAY_GROUP_DATE_OPTIONS,
  DAY_GROUP_DATE_WITH_YEAR_OPTIONS,
} from './group-chats-by-day.config';

/** Секция для SectionList: закрепленные или одна календарная группа */
export type ChatListSection = {
  key: string;
  title: string | null;
  data: ChatRecord[];
};

/** Ключ календарного дня (локальная дата) для группировки */
function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDayTitle(timestamp: number, locale: Locale): string {
  const date = new Date(timestamp);
  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  const options = isCurrentYear
    ? DAY_GROUP_DATE_OPTIONS[locale]
    : DAY_GROUP_DATE_WITH_YEAR_OPTIONS[locale];

  return new Intl.DateTimeFormat(locale, options).format(date);
}

function sortChats(
  chats: ChatRecord[],
  direction: SortDirection,
): ChatRecord[] {
  const sorted = [...chats].sort((a, b) => a.updatedAt - b.updatedAt);

  return direction === 'newest' ? sorted.reverse() : sorted;
}

/**
 * Группирует чаты для списка:
 * - закрепленные — отдельная секция всегда сверху, вне дневных групп;
 * - остальные — по календарным дням, заголовок — только дата
 *   («11 окт» / «Oct 12», для прошлых лет с годом: «11 окт 2025»);
 * - направление сортировки из sortDirection (внутри дня тот же порядок).
 */
export function groupChatsByDay(
  chats: ChatRecord[],
  sortDirection: SortDirection,
  locale: Locale,
  pinnedTitle: string,
): ChatListSection[] {
  const pinned = sortChats(
    chats.filter((chat) => chat.isPinned),
    sortDirection,
  );

  const byDay = new Map<string, ChatRecord[]>();

  for (const chat of chats) {
    if (chat.isPinned) continue;

    const key = dayKey(chat.updatedAt);
    const bucket = byDay.get(key);

    if (bucket) {
      bucket.push(chat);
    } else {
      byDay.set(key, [chat]);
    }
  }

  // Ключи YYYY-MM-DD сортируются лексикографически:
  // по возрастанию — от старых дней к новым
  const dayKeys = [...byDay.keys()].sort();
  if (sortDirection === 'newest') dayKeys.reverse();

  const daySections: ChatListSection[] = dayKeys.map((key) => {
    const dayChats = sortChats(byDay.get(key) ?? [], sortDirection);
    const title = formatDayTitle(dayChats[0].updatedAt, locale);

    return { key: `day-${key}`, title, data: dayChats };
  });

  const sections: ChatListSection[] = [];

  if (pinned.length > 0) {
    sections.push({ key: 'pinned', title: pinnedTitle, data: pinned });
  }

  sections.push(...daySections);

  return sections;
}
