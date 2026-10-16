import { FlatList, SectionList, Text } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import type {
  ChatListSection as ChatListSectionType,
  ChatSearchResult,
} from "@/features/chats";
import { splitTitleByRanges } from "@/features/chats";
import {
  ScrollIndicator,
  useScrollIndicator,
} from "@/shared/components/ui/ScrollIndicator";
import { useT } from "@/shared/i18n";
import type { ChatRecord } from "@/types/chat";

import { ChatListItem } from "./ChatListItem";
import { ChatListSection } from "./ChatListSection";

type CommonItemProps = {
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRenameComplete: () => void;
  onTogglePin: (chat: ChatRecord) => void;
  onDelete: (id: string) => void;
};

// ---------------------------------------------------------------------------
// Список всех чатов (SectionList, секции по дням + закреплённые)
// ---------------------------------------------------------------------------

type ChatSectionListProps = CommonItemProps & {
  sections: ChatListSectionType[];
  isLoading: boolean;
};

export function ChatSectionList({
  sections,
  isLoading,
  activeChatId,
  onSelect,
  onRename,
  onRenameComplete,
  onTogglePin,
  onDelete,
}: ChatSectionListProps) {
  const t = useT();
  const scroll = useScrollIndicator({ verticalPadding: 8 });

  return (
    <>
      <SectionList
        className="flex-1"
        sections={sections}
        keyExtractor={(chat) => chat.id}
        renderItem={({ item }: { item: ChatRecord }) => (
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
              onSelect={onSelect}
              onRename={onRename}
              onRenameComplete={onRenameComplete}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
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
      <ScrollIndicator style={scroll.thumbStyle} side="right" inset={-6} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Список результатов поиска (FlatList, плоский)
// ---------------------------------------------------------------------------

type ChatSearchListProps = CommonItemProps & {
  results: ChatSearchResult[];
  isSearching: boolean;
};

export function ChatSearchList({
  results,
  isSearching,
  activeChatId,
  onSelect,
  onRename,
  onRenameComplete,
  onTogglePin,
  onDelete,
}: ChatSearchListProps) {
  const t = useT();
  const scroll = useScrollIndicator({ verticalPadding: 8 });

  return (
    <>
      <FlatList
        className="flex-1"
        data={results}
        keyExtractor={(result) => result.chat.id}
        renderItem={({ item }: { item: ChatSearchResult }) => (
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
              onSelect={onSelect}
              onRename={onRename}
              onRenameComplete={onRenameComplete}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
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
      <ScrollIndicator style={scroll.thumbStyle} side="right" inset={-6} />
    </>
  );
}
