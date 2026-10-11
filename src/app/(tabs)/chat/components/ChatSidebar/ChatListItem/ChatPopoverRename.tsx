import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

import type { ChatPopoverContentProps } from "./ChatItemPopover.types";

/** Режим rename: инлайн-переименование чата */
export function ChatPopoverRename({
  chat,
  close,
  onRename,
}: ChatPopoverContentProps) {
  const t = useT();

  // Компонент монтируется только в режиме rename,
  // поэтому начальное значение всегда актуальное название
  const [renameText, setRenameText] = useState(chat.title);

  const canSave = renameText.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onRename(chat.id, renameText.trim());
    close();
  };

  return (
    <View className="gap-2 p-2">
      <TextInput
        value={renameText}
        onChangeText={setRenameText}
        placeholder={t("chats.renameChat")}
        placeholderTextColor={colors.placeholder}
        autoFocus
        selectTextOnFocus
        scrollEnabled={false}
        multiline={false}
        textAlignVertical="center"
        style={{ height: 36, paddingVertical: 0 }}
        className="rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-text-primary"
      />
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
          accessibilityLabel={t("common.save")}
          onPress={handleSave}
          disabled={!canSave}
          className={cn(
            "rounded-lg px-3 py-1.5",
            canSave ? "bg-accent active:bg-accent-soft" : "bg-white/5",
          )}
        >
          <Text
            className={cn(
              "text-sm font-medium",
              canSave ? "text-white" : "text-text-muted",
            )}
          >
            {t("common.save")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
