import { ArrowDown, ArrowUp, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, SectionList, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  groupChatsByDay,
  useChatActions,
  useChats,
  useChatsStore,
  useCreateChat,
} from "@/features/chats";
import { colors } from "@/shared/config/colors";
import { useLocaleContext, useT } from "@/shared/i18n";

import { ChatListItem } from "./ChatListItem";
import { ChatListSection } from "./ChatListSection";
import {
  ANIMATION_DURATION,
  CONTENT_TOP_OFFSET,
  PANEL_BOTTOM_RADIUS,
} from "./ChatSidebar.config";
import type { ChatSidebarProps } from "./ChatSidebar.types";

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const { locale } = useLocaleContext();
  const { chats, isLoading } = useChats();
  const { createChat } = useCreateChat();
  const { renameChat, togglePin, deleteChat } = useChatActions();

  const activeChatId = useChatsStore((state) => state.activeChatId);
  const setActiveChat = useChatsStore((state) => state.setActiveChat);
  const sortDirection = useChatsStore((state) => state.sortDirection);
  const setSortDirection = useChatsStore((state) => state.setSortDirection);

  // Поиск неактивен в этой итерации — только UI
  const [searchQuery, setSearchQuery] = useState("");

  const sections = useMemo(
    () => groupChatsByDay(chats, sortDirection, locale, t("chats.pinned")),
    [chats, sortDirection, locale, t],
  );

  const handleSelectChat = (id: string) => {
    setActiveChat(id);
    onClose?.();
  };

  const handleCreateChat = async () => {
    await createChat();
    onClose?.();
  };

  const handleToggleSort = () => {
    setSortDirection(sortDirection === "newest" ? "oldest" : "newest");
  };

  return (
    <View
      className="flex-1 px-3 pb-3"
      style={{ paddingTop: CONTENT_TOP_OFFSET }}
    >
      <Text className="text-base font-semibold text-text-primary">
        {t("chats.title")}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("chats.newChat")}
        onPress={handleCreateChat}
        className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:bg-accent-soft"
      >
        <Plus size={16} color="#FFFFFF" />
        <Text className="text-sm font-medium text-white">
          {t("chats.newChat")}
        </Text>
      </Pressable>

      <View className="mt-3 flex-row items-center gap-2">
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("chats.searchPlaceholder")}
          placeholderTextColor={colors.placeholder}
          scrollEnabled={false}
          multiline={false}
          textAlignVertical="center"
          style={{ height: 36, paddingVertical: 0 }}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-text-primary"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            sortDirection === "newest"
              ? t("chats.sortNewestFirst")
              : t("chats.sortOldestFirst")
          }
          onPress={handleToggleSort}
          hitSlop={4}
          className="h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 active:bg-white/10"
        >
          {sortDirection === "newest" ? (
            <ArrowUp size={16} color={colors.textMuted} />
          ) : (
            <ArrowDown size={16} color={colors.textMuted} />
          )}
        </Pressable>
      </View>

      <SectionList
        className="mt-1 flex-1"
        sections={sections}
        keyExtractor={(chat) => chat.id}
        renderItem={({ item }) => (
          <ChatListItem
            chat={item}
            isActive={item.id === activeChatId}
            onSelect={handleSelectChat}
            onRename={renameChat}
            onTogglePin={togglePin}
            onDelete={deleteChat}
          />
        )}
        renderSectionHeader={({ section }) => (
          <ChatListSection section={section} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <Text className="px-2 pt-4 text-sm text-text-muted">
              {t("chats.empty")}
            </Text>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
      />
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
  const t = useT();
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
            accessibilityLabel={t("chats.closePanel")}
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
        {/* На мобиле выбор/создание чата закрывает панель */}
        <SidebarContent onClose={isDesktop ? undefined : onClose} />
      </Animated.View>
    </>
  );
}
