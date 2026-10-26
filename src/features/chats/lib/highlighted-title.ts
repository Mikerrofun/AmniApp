import {
  FTS_HIGHLIGHT_END,
  FTS_HIGHLIGHT_START,
} from '@/shared/lib/search';

import type { TitleMatchRange, TitleSegment } from '../model/search-store.types';

/**
 * Разбирает title с маркерами FTS5 highlight() в диапазоны совпадений.
 * Индексы по code units (срезы title.slice), end не включается.
 */
export function parseHighlightedTitle(
  highlightedTitle: string,
): TitleMatchRange[] {
  const ranges: TitleMatchRange[] = [];
  let matchStart: number | null = null;
  let offset = 0;

  for (const char of highlightedTitle) {
    if (char === FTS_HIGHLIGHT_START) {
      matchStart = offset;
    } else if (char === FTS_HIGHLIGHT_END) {
      if (matchStart !== null) {
        ranges.push({ start: matchStart, end: offset });
        matchStart = null;
      }
    } else {
      offset += char.length;
    }
  }

  return ranges;
}

/** Разбивает title на сегменты «совпало / не совпало» для рендера подсветки */
export function splitTitleByRanges(
  title: string,
  ranges: TitleMatchRange[],
): TitleSegment[] {
  if (ranges.length === 0) return [{ text: title, isMatch: false }];

  const segments: TitleSegment[] = [];
  let cursor = 0;

  for (const { start, end } of [...ranges].sort((a, b) => a.start - b.start)) {
    if (start > cursor) {
      segments.push({ text: title.slice(cursor, start), isMatch: false });
    }

    segments.push({ text: title.slice(start, end), isMatch: true });
    cursor = Math.max(cursor, end);
  }

  if (cursor < title.length) {
    segments.push({ text: title.slice(cursor), isMatch: false });
  }

  return segments;
}
