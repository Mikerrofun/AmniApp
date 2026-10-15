import { MessageCirclePlus } from "lucide-react-native";
import { Pressable } from "react-native";

import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

import type { TempChatButtonProps } from "./TempChatButton.types";
import { useTempChatButton } from "./useTempChatButton";

/** Размер совпадает с триггером панели */
const BUTTON_SIZE = 38;
const ICON_SIZE = 16;

/**
 * Кнопка временного чата: круглая, зеркальна триггеру панели.
 * Позиционирование (справа) — в SidebarHandler.
 */
export function TempChatButton({
  onCloseSidebar,
  className,
}: TempChatButtonProps) {
  const t = useT();
  const { handlePress } = useTempChatButton(onCloseSidebar);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t("chats.newTempChat")}
      hitSlop={6}
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
      className={cn(
        "items-center justify-center rounded-full border border-white/15 bg-white/5 active:bg-white/10",
        className,
      )}
    >
      <MessageCirclePlus size={ICON_SIZE} color="#FFFFFF" />
    </Pressable>
  );
}
