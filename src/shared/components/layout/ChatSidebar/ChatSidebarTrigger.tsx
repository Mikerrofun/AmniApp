import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/shared/lib/cn';

import type { ChatSidebarTriggerProps } from './ChatSidebar.types';

/** Размер кнопки одинаков на всех платформах */
const TRIGGER_SIZE = 30;
const ICON_SIZE = 12;
const ANIMATION_DURATION = 200;

/**
 * Кнопка вызова панели: пустой закруглённый квадрат сероватого оттенка.
 * Когда панель открыта — превращается в крестик для закрытия.
 */
export function ChatSidebarTrigger({ isOpen, onPress, className }: ChatSidebarTriggerProps) {
  const progress = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: ANIMATION_DURATION,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [isOpen, progress]);

  const crossStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

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
    >
      <Animated.View
        style={[{ width: ICON_SIZE, height: ICON_SIZE }, crossStyle]}
        className="absolute items-center justify-center"
      >
        <View className="absolute h-[1.5px] w-full rotate-45 rounded-full bg-text-muted" />
        <View className="absolute h-[1.5px] w-full -rotate-45 rounded-full bg-text-muted" />
      </Animated.View>
    </Pressable>
  );
}
