import { Pressable } from 'react-native';

import { cn } from '@/shared/lib/cn';

import type { ChatSidebarTriggerProps } from './ChatSidebar.types';

/** Размер кнопки одинаков на всех платформах */
const TRIGGER_SIZE = 30;

/**
 * Кнопка вызова панели: пустой закруглённый квадрат сероватого оттенка.
 * Один и тот же квадратик открывает и закрывает панель.
 */
export function ChatSidebarTrigger({ isOpen, onPress, className }: ChatSidebarTriggerProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? 'Закрыть панель чатов' : 'Открыть панель чатов'}
      hitSlop={6}
      style={{ width: TRIGGER_SIZE, height: TRIGGER_SIZE }}
      className={cn(
        'items-center justify-center rounded-[10px] border border-white/15 bg-white/5 active:bg-white/10',
        className,
      )}
    />
  );
}
