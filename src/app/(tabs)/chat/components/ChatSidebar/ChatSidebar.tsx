import { ArrowDown, ArrowUp, Plus } from "lucide-react-native";
import { useEffect } from "react";
import {
  FlatList,
  Pressable,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  splitTitleByRanges,
  useChatActions,
  useChatSearch,
  useChats,
  useChatsStore,
} from "@/features/chats";
import {
  ScrollIndicator,
  useScrollIndicator,
} from "@/shared/components/ui/ScrollIndicator";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import { ChatListItem } from "./ChatListItem";
import { ChatListSection } from "./ChatListSection";
import {
  ANIMATION_DURATION,
  CONTENT_TOP_OFFSET,
  PANEL_BOTTOM_RADIUS,
} from "./ChatSidebar.config";
import {
  useChatSections,
  useSearchResetOnClose,
  useSidebarHandlers,
} from "./ChatSidebar.hooks";
import type { ChatSidebarProps } from "./ChatSidebar.types";

function SidebarContent({
  onClose,
  isOpen,
}: {
  onClose?: () => void;
  isOpen: boolean;
}) {
  const t = useT();
  const { chats, isLoading } = useChats();
  const { renameChat, togglePin, deleteChat } = useChatActions();
  const { query, results, isSearching, handleChangeText, resetSearch } =
    useChatSearch();

  const activeChatId = useChatsStore((state) => state.activeChatId);
  const sortDirection = useChatsStore((state) => state.sortDirection);

  const scroll = useScrollIndicator({ verticalPadding: 8 });

  const isSearchActive = query.trim() !== "";
  useSearchResetOnClose(isOpen, resetSearch);

  const { sections, pinnedCount } = useChatSections(chats, sortDirection);

  // Список перемонтируется при смене сортировки/pin'ов (key ниже) и
  // при переключении в поиск — сбрасываем индикатор синхронно, иначе
  // тумба прыгает по stale-смещению до первого scroll-события.
  // resetScroll стабилен (useCallback в хуке)
  const listKey = `all-chats:${sortDirection}:${pinnedCount}`;
  const { resetScroll } = scroll;
  useEffect(() => {
    resetScroll();
  }, [listKey, isSearchActive, resetScroll]);
  const {
    handleSelectChat,
    handleCreateChat,
    handleRenameComplete,
    handleToggleSort,
  } = useSidebarHandlers(onClose, resetSearch);

  return (
    <View
      className="flex-1 px-3 pb-3"
      style={{ paddingTop: CONTENT_TOP_OFFSET }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("chats.newChat")}
        onPress={handleCreateChat}
        className="h-10 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:bg-accent-soft"
      >
        <Plus size={16} color="#FFFFFF" />
        <Text className="text-sm font-medium text-white">
          {t("chats.newChat")}
        </Text>
      </Pressable>

      <View className="mt-3 flex-row items-center gap-2">
        <TextInput
          value={query}
          onChangeText={handleChangeText}
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

      <View className="relative mt-1 flex-1">
        {/* Затемнение при активном поиске */}
        {isSearchActive && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            className="absolute inset-0 z-10 bg-black/20"
            pointerEvents="none"
          />
        )}

        {/* Список всех чатов (по умолчанию) */}
        {!isSearchActive && (
          <Animated.View
            key={`all-chats:${sortDirection}:${pinnedCount}`}
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            className="absolute inset-0"
          >
            <SectionList
              className="flex-1"
              sections={sections}
              keyExtractor={(chat) => chat.id}
              renderItem={({ item }) => (
                <Animated.View
                  layout={LinearTransition.duration(200).easing(
                    Easing.bezier(0.22, 1, 0.36, 1),
                  )}
                  entering={FadeIn.duration(250)}
                  exiting={FadeOut.duration(150)}
                >
                  <ChatListItem
                    chat={item}
                    isActive={item.id === activeChatId}
                    onSelect={handleSelectChat}
                    onRename={renameChat}
                    onRenameComplete={handleRenameComplete}
                    onTogglePin={togglePin}
                    onDelete={deleteChat}
                  />
                </Animated.View>
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
              onScroll={scroll.onScroll}
              onContentSizeChange={(width, height) =>
                scroll.onContentSizeChange({
                  nativeEvent: { contentSize: { width, height } },
                })
              }
              onLayout={scroll.onLayout}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingBottom: 8 }}
            />
          </Animated.View>
        )}

        {/* Список результатов поиска */}
        {isSearchActive && (
          <Animated.View
            key="search-results"
            entering={FadeIn.duration(300).delay(100)}
            exiting={FadeOut.duration(200)}
            className="absolute inset-0"
          >
            <FlatList
              className="flex-1"
              data={results}
              keyExtractor={(result) => result.chat.id}
              renderItem={({ item }) => (
                <Animated.View
                  layout={LinearTransition.duration(200).easing(
                    Easing.bezier(0.22, 1, 0.36, 1),
                  )}
                  entering={FadeIn.duration(250)}
                  exiting={FadeOut.duration(150)}
                >
                  <ChatListItem
                    chat={item.chat}
                    isActive={item.chat.id === activeChatId}
                    onSelect={handleSelectChat}
                    onRename={renameChat}
                    onRenameComplete={handleRenameComplete}
                    onTogglePin={togglePin}
                    onDelete={deleteChat}
                    titleSegments={splitTitleByRanges(
                      item.chat.title,
                      item.titleRanges,
                    )}
                  />
                </Animated.View>
              )}
              ListEmptyComponent={
                !isSearching ? (
                  <Text className="px-2 pt-4 text-sm text-text-muted">
                    {t("chats.searchEmpty")}
                  </Text>
                ) : null
              }
              showsVerticalScrollIndicator={false}
              onScroll={scroll.onScroll}
              onContentSizeChange={(width, height) =>
                scroll.onContentSizeChange({
                  nativeEvent: { contentSize: { width, height } },
                })
              }
              onLayout={scroll.onLayout}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingBottom: 8 }}
            />
          </Animated.View>
        )}

        {/* Тонкий индикатор прокрутки справа, когда чатов много */}
        <ScrollIndicator
          style={scroll.thumbStyle}
          side="right"
          inset={-6}
        />
      </View>
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
        <SidebarContent
          isOpen={isOpen}
          onClose={isDesktop ? undefined : onClose}
        />
      </Animated.View>
    </>
  );
}
