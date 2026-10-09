import { useEffect } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/shared/lib/cn';

import type { ChatSidebarProps } from './ChatSidebar.types';

const ANIMATION_DURATION = 260;

type SidebarContentProps = Pick<ChatSidebarProps, 'onClose' | 'onCreateChat' | 'onSearch'>;

function SidebarContent({ onClose, onCreateChat, onSearch }: SidebarContentProps) {
  return (
    <View className="flex-1 px-3 pt-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-text-primary">Чаты</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Закрыть панель чатов"
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-lg active:bg-white/10"
        >
          <View className="h-[14px] w-[14px]">
            <View className="absolute h-[1.5px] w-full translate-y-[6px] rotate-45 rounded-full bg-text-muted" />
            <View className="absolute h-[1.5px] w-full translate-y-[6px] -rotate-45 rounded-full bg-text-muted" />
          </View>
        </Pressable>
      </View>

      {/* Задел под будущий поиск по чатам */}
      <TextInput
        placeholder="Поиск по чатам"
        placeholderTextColor="#8A8A90"
        onChangeText={onSearch}
        className="mt-3 h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary"
      />

      {/* Задел под будущий список чатов */}
      <View className="mt-3 flex-1 items-center justify-center">
        <Text className="text-sm text-text-muted">Здесь появится список чатов</Text>
      </View>

      {/* Задел под будущее создание чатов */}
      <Pressable
        onPress={onCreateChat}
        accessibilityRole="button"
        accessibilityLabel="Создать новый чат"
        className="mb-3 h-10 items-center justify-center rounded-xl bg-accent active:bg-accent-soft"
      >
        <Text className="text-sm font-medium text-white">Новый чат</Text>
      </Pressable>
    </View>
  );
}

export function ChatSidebar({
  isOpen,
  onClose,
  isDesktop,
  sidebarWidth,
  onCreateChat,
  onSelectChat,
  onSearch,
  className,
}: ChatSidebarProps) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: ANIMATION_DURATION,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [isOpen, progress]);

  const desktopStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [0, sidebarWidth], Extrapolation.CLAMP),
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-sidebarWidth, 0], Extrapolation.CLAMP) },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  // Десктоп/веб: панель встроена в layout и сжимается по ширине
  if (isDesktop) {
    return (
      <Animated.View
        style={desktopStyle}
        className={cn('h-full overflow-hidden border-r border-white/5 bg-card', className)}
      >
        <View style={{ width: sidebarWidth }} className="flex-1">
          <SidebarContent onClose={onClose} onCreateChat={onCreateChat} onSearch={onSearch} />
        </View>
      </Animated.View>
    );
  }

  // Телефон: панель выезжает поверх контента, тап по затемнению закрывает
  return (
    <>
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={backdropStyle}
        className="absolute inset-0 z-40 bg-black/50"
      >
        <Pressable
          className="flex-1"
          onPress={onClose}
          accessibilityLabel="Закрыть панель чатов"
        />
      </Animated.View>
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[overlayStyle, { width: sidebarWidth, paddingTop: insets.top }]}
        className={cn(
          'absolute bottom-0 left-0 top-0 z-50 border-r border-white/5 bg-card',
          className,
        )}
      >
        <SidebarContent onClose={onClose} onCreateChat={onCreateChat} onSearch={onSearch} />
      </Animated.View>
    </>
  );
}
