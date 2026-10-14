import { EllipsisVertical, Pin } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { usePopoverAnchor } from "@/shared/components/ui/PopoverMenu";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

import { ChatItemPopover } from "./ChatItemPopover";
import type { ChatListItemProps, ChatPopoverMode } from "./ChatListItem.types";

export function ChatListItem({
  chat,
  isActive,
  onSelect,
  onRename,
  onTogglePin,
  onDelete,
  titleSegments,
}: ChatListItemProps) {
  const t = useT();
  const { anchorRef, anchor, measure } = usePopoverAnchor();

  const [popover, setPopover] = useState<{
    open: boolean;
    mode: ChatPopoverMode;
  }>({ open: false, mode: "menu" });
  const [isHovered, setIsHovered] = useState(false);

  const openPopover = (mode: ChatPopoverMode) => {
    measure();
    setPopover({ open: true, mode });
  };

  const closePopover = () => setPopover({ open: false, mode: "menu" });

  const showDots = Platform.OS === "web" ? isHovered || popover.open : true;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("chats.selectChat", { title: chat.title })}
      accessibilityState={{ selected: isActive }}
      onPress={() => onSelect(chat.id)}
      onLongPress={() => openPopover("menu")}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      className={cn(
        "flex-row items-center gap-1 rounded-xl px-2 py-2",
        isActive ? "bg-white/10" : "active:bg-white/5",
      )}
    >
      <View className="min-w-0 flex-1">
        {/* key по названию: при переименовании перерисовывается
            только этот элемент — заголовок мягко проявляется */}
        <Animated.Text
          key={chat.title}
          entering={FadeIn.duration(200)}
          numberOfLines={1}
          className={cn(
            "text-base text-text-primary",
            isActive && "font-semibold",
          )}
        >
          {titleSegments
            ? titleSegments.map((segment, index) => (
                <Text
                  key={`${index}:${segment.text}`}
                  style={
                    segment.isMatch
                      ? { color: colors.accent, fontWeight: "600" }
                      : undefined
                  }
                >
                  {segment.text}
                </Text>
              ))
            : chat.title}
        </Animated.Text>
      </View>

      {/* Гвоздик только у закрепленных чатов; открепить — через меню */}
      {chat.isPinned && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("popover.unpin")}
          hitSlop={6}
          onPress={() => onTogglePin(chat)}
          className="p-1"
        >
          <Pin
            size={14}
            color={colors.accent}
            fill={colors.accent}
          />
        </Pressable>
      )}

      {showDots && (
        <View ref={anchorRef} collapsable={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("chats.chatActions", { title: chat.title })}
            hitSlop={6}
            onPress={() => openPopover("menu")}
            className="p-1"
          >
            <EllipsisVertical size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      <ChatItemPopover
        chat={chat}
        mode={popover.mode}
        open={popover.open}
        anchor={anchor}
        onClose={closePopover}
        onModeChange={(mode) => setPopover((prev) => ({ ...prev, mode }))}
        onRename={onRename}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    </Pressable>
  );
}
