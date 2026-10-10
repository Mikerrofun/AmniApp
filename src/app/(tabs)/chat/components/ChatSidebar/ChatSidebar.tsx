import { useEffect } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/shared/config/colors";

import {
  ANIMATION_DURATION,
  CONTENT_TOP_OFFSET,
  PANEL_BOTTOM_RADIUS,
} from "./ChatSidebar.config";
import type { ChatSidebarProps } from "./ChatSidebar.types";

function SidebarContent() {
  // TODO: Здесь будут хуки для работы с чатами:
  // - useChats() для получения списка чатов
  // - useCreateChat() для создания нового чата
  // - useChatSearch() для поиска по чатам

  return (
    <View
      className="flex-1 px-3 pb-3"
      style={{ paddingTop: CONTENT_TOP_OFFSET }}
    >
      <Text className="text-base font-semibold text-text-primary">Чаты</Text>

      <TextInput
        placeholder="Поиск по чатам"
        placeholderTextColor={colors.placeholder}
        className="mt-3 h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary"
      />

      <View className="mt-3">
        <Text className="text-sm text-text-muted">
          Здесь появится список чатов
        </Text>
      </View>

      <Pressable
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
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-sidebarWidth, 0],
          Extrapolation.CLAMP,
        ),
      },
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
          pointerEvents={isOpen ? "auto" : "none"}
          style={[
            backdropStyle,
            {
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 40,
              backgroundColor: colors.backdrop,
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
        pointerEvents={isOpen ? "auto" : "none"}
        style={[
          panelStyle,
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 50,
            width: sidebarWidth,
            paddingTop: insets.top,
            backgroundColor: colors.panelBackground,
            borderRightWidth: 1,
            borderRightColor: colors.panelBorder,
            borderBottomLeftRadius: PANEL_BOTTOM_RADIUS,
            borderBottomRightRadius: PANEL_BOTTOM_RADIUS,
          },
        ]}
      >
        <SidebarContent />
      </Animated.View>
    </>
  );
}
