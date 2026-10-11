import { Pencil, Pin, PinOff, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { PopoverMenu } from "@/shared/components/ui/PopoverMenu";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

import type { ChatItemPopoverProps } from "./ChatItemPopover.types";
import { CHAT_POPOVER_WIDTH } from "./ChatListItem.config";

type MenuItemProps = {
  icon: typeof Pin;
  label: string;
  danger?: boolean;
  onPress: () => void;
};

function MenuItem({
  icon: Icon,
  label,
  danger = false,
  onPress,
}: MenuItemProps) {
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

/**
 * Содержимое popover'а чата — три состояния внутри одного popover'а:
 * menu (действия), rename (переименование), delete (подтверждение удаления).
 */
export function ChatItemPopover({
  chat,
  mode,
  open,
  anchor,
  onClose,
  onModeChange,
  onRename,
  onTogglePin,
  onDelete,
}: ChatItemPopoverProps) {
  const t = useT();
  const [renameText, setRenameText] = useState(chat.title);

  /** Закрытие со сбросом режима в menu */
  const close = () => {
    onModeChange("menu");
    onClose();
  };

  const canSave = renameText.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onRename(chat.id, renameText.trim());
    close();
  };

  return (
    <PopoverMenu
      open={open}
      onClose={close}
      anchor={anchor}
      width={CHAT_POPOVER_WIDTH}
    >
      {mode === "menu" && (
        <View>
          <MenuItem
            icon={Pencil}
            label={t("popover.rename")}
            onPress={() => {
              // Подставляем текущее название при входе в режим переименования
              setRenameText(chat.title);
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
      )}

      {mode === "rename" && (
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
              <Text className="text-sm text-text-muted">
                {t("common.cancel")}
              </Text>
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
      )}

      {mode === "delete" && (
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
              <Text className="text-sm text-text-muted">
                {t("common.cancel")}
              </Text>
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
      )}
    </PopoverMenu>
  );
}
