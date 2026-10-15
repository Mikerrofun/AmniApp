import { Pressable } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { useT } from '@/shared/i18n';

import type { ChatSidebarTriggerProps } from './ChatSidebar.types';

/** Размер кнопки одинаков на всех платформах */
const TRIGGER_SIZE = 38;

/**
 * Кнопка вызова панели: пустой закруглённый квадрат сероватого оттенка.
 * Один и тот же квадратик открывает и закрывает панель.
 */
export function ChatSidebarTrigger({ isOpen, onPress, className }: ChatSidebarTriggerProps) {
  const t = useT();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isOpen ? t('chats.closePanel') : t('chats.openPanel')}
      hitSlop={6}
      style={{ width: TRIGGER_SIZE, height: TRIGGER_SIZE }}
      className={cn(
        'items-center justify-center rounded-[10px] border border-white/15 bg-white/5 active:bg-white/10',
        className,
      )}
    />
  );
}
