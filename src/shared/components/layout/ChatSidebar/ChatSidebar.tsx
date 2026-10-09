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

import type { ChatSidebarProps } from './ChatSidebar.types';

const ANIMATION_DURATION = 260;
/** Контент панели начинается ниже кнопки-триггера (12 + 30 + зазор) */
const CONTENT_TOP_OFFSET = 56;

/**
 * Критические стили панели заданы инлайн: className на Animated.View
 * (Reanimated) может не применяться, из-за чего панель теряет фон и позицию.
 */
const PANEL_BACKGROUND_COLOR = '#0E0E10';
const PANEL_BORDER_COLOR = 'rgba(255, 255, 255, 0.15)';
const BACKDROP_COLOR = 'rgba(0, 0, 0, 0.5)';

type SidebarContentProps = Pick<ChatSidebarProps, 'onCreateChat' | 'onSearch'>;

function SidebarContent({ onCreateChat, onSearch }: SidebarContentProps) {
  return (
    <View className="flex-1 px-3 pb-3" style={{ paddingTop: CONTENT_TOP_OFFSET }}>
      <Text className="text-base font-semibold text-text-primary">Чаты</Text>

      {/* Задел под будущий поиск по чатам */}
      <TextInput
        placeholder="Поиск по чатам"
        placeholderTextColor="#8A8A90"
        onChangeText={onSearch}
        className="mt-3 h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary"
      />

      {/* Задел под будущий список чатов */}
      <View className="mt-3">
        <Text className="text-sm text-text-muted">Здесь появится список чатов</Text>
      </View>

      {/* Задел под будущее создание чатов */}
      <Pressable
        onPress={onCreateChat}
        accessibilityRole="button"
        accessibilityLabel="Создать новый чат"
        className="mt-3 h-10 items-center justify-center rounded-xl bg-accent active:bg-accent-soft"
      >
        <Text className="text-sm font-medium text-white">Новый чат</Text>
      </Pressable>
    </View>
  );
}

/**
 * Панель чатов. Всегда открывается поверх контента (на всех платформах),
 * контент страницы никогда не сдвигается.
 */
export function ChatSidebar({
  isOpen,
  onClose,
  isDesktop,
  sidebarWidth,
  onCreateChat,
  onSearch,
}: ChatSidebarProps) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: ANIMATION_DURATION,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [isOpen, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-sidebarWidth, 0], Extrapolation.CLAMP) },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <>
      {/* Затемнение только на телефоне: тап по фону закрывает панель */}
      {!isDesktop && (
        <Animated.View
          pointerEvents={isOpen ? 'auto' : 'none'}
          style={[
            backdropStyle,
            {
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 40,
              backgroundColor: BACKDROP_COLOR,
            },
          ]}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={onClose}
            accessibilityLabel="Закрыть панель чатов"
          />
        </Animated.View>
      )}

      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[
          panelStyle,
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 50,
            width: sidebarWidth,
            paddingTop: insets.top,
            backgroundColor: PANEL_BACKGROUND_COLOR,
            borderRightWidth: 1,
            borderRightColor: PANEL_BORDER_COLOR,
          },
        ]}
      >
        <SidebarContent onCreateChat={onCreateChat} onSearch={onSearch} />
      </Animated.View>
    </>
  );
}
