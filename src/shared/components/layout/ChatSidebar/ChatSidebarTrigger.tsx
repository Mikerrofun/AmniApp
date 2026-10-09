import { Pressable } from 'react-native';

import { cn } from '@/shared/lib/cn';

import type { ChatSidebarTriggerProps } from './ChatSidebar.types';

/** Кнопка вызова панели: пустой закруглённый квадрат сероватого оттенка */
export function ChatSidebarTrigger({ onPress, className }: ChatSidebarTriggerProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Открыть панель чатов"
      hitSlop={4}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-[14px] border border-white/15 bg-white/5 active:bg-white/10',
        className,
      )}
    />
  );
}
