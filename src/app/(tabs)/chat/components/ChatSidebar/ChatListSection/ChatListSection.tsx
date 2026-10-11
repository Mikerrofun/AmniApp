import { Text } from 'react-native';

import type { ChatListSectionProps } from './ChatListSection.types';

/** Заголовок секции списка: «Закрепленные» или «11.10 — N» */
export function ChatListSection({ section }: ChatListSectionProps) {
  if (!section.title) return null;

  return (
    <Text className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-text-muted">
      {section.title}
    </Text>
  );
}
