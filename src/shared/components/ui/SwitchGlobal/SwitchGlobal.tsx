import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { cn } from '@/shared/lib/cn';

import { useSwitchGlobalHook } from './SwitchGlobal.hooks';
import type { SwitchGlobalProps } from './SwitchGlobal.types';

export function SwitchGlobal({
  options,
  value,
  onChange,
  equalWidth = true,
  className,
  sliderClassName,
}: SwitchGlobalProps) {
  const { left, width, height, onItemLayout } = useSwitchGlobalHook(value);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: left.value,
    width: width.value,
    height: height.value,
  }));

  if (options.length === 0) return null;

  return (
    <View
      accessibilityRole="tablist"
      className={cn(
        'relative flex-row items-center rounded-md',
        equalWidth ? 'w-full' : 'self-start',
        className,
      )}
    >
      {/* Геометрия — на Animated.View через inline-стиль (NativeWind не
          применяет className к обёрнутым reanimated-компонентам), визуал —
          на обычном внутреннем View. */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0 }, indicatorStyle]}
      >
        <View className={cn('h-full w-full rounded-md bg-accent', sliderClassName)} />
      </Animated.View>
      {options.map((option) => {
        const isActive = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            aria-selected={isActive}
            accessibilityLabel={option.key}
            onPress={() => {
              if (!isActive) onChange?.(option.key);
            }}
            onLayout={(event) => onItemLayout(option.key, event.nativeEvent.layout)}
            className={cn(equalWidth && 'flex-1', 'items-center justify-center')}
          >
            {option.component}
          </Pressable>
        );
      })}
    </View>
  );
}
