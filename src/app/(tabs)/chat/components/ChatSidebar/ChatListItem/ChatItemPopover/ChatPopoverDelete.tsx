import { Pressable, Text, View } from "react-native";

import { useT } from "@/shared/i18n";

import type { ChatPopoverContentProps } from "./ChatItemPopover.types";

/** Режим delete: подтверждение удаления чата */
export function ChatPopoverDelete({
  chat,
  close,
  onDelete,
}: ChatPopoverContentProps) {
  const t = useT();

  return (
    <View className="gap-2 p-2">
      <Text className="text-sm text-text-primary">
        {t("popover.deleteConfirm", { title: chat.title })}
      </Text>
      <View className="flex-row justify-end gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={close}
          className="rounded-lg px-3 py-1.5 active:bg-white/10"
        >
          <Text className="text-sm text-text-muted">{t("common.cancel")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.delete")}
          onPress={() => {
            onDelete(chat.id);
            close();
          }}
          className="rounded-lg bg-accent px-3 py-1.5 active:bg-accent-soft"
        >
          <Text className="text-sm font-medium text-white">
            {t("common.delete")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
