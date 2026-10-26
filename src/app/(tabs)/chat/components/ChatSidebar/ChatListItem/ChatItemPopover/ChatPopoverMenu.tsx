import { Pencil, Pin, PinOff, Trash2 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

import type {
  ChatPopoverContentProps,
  MenuItemProps,
} from "./ChatItemPopover.types";

function MenuItem({ icon: Icon, label, danger = false, onPress }: MenuItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-2 px-3 py-2 active:bg-white/10"
    >
      <Icon size={16} color={danger ? colors.accent : colors.textMuted} />
      <Text
        className={cn("text-sm", danger ? "text-accent" : "text-text-primary")}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Режим menu: список действий над чатом */
export function ChatPopoverMenu({
  chat,
  close,
  onModeChange,
  onTogglePin,
}: ChatPopoverContentProps) {
  const t = useT();

  return (
    <View>
      <MenuItem
        icon={Pencil}
        label={t("popover.rename")}
        onPress={() => {
          onModeChange("rename");
        }}
      />
      <MenuItem
        icon={chat.isPinned ? PinOff : Pin}
        label={chat.isPinned ? t("popover.unpin") : t("popover.pin")}
        onPress={() => {
          onTogglePin(chat);
          close();
        }}
      />
      <MenuItem
        icon={Trash2}
        label={t("popover.delete")}
        danger
        onPress={() => onModeChange("delete")}
      />
    </View>
  );
}
