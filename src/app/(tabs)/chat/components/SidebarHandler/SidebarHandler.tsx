import { Text, View } from "react-native";

import { useT } from "@/shared/i18n";

import { ChatSidebar, ChatSidebarTrigger, TempChatButton } from "../ChatSidebar";

import type { SidebarHandlerProps } from "./SidebarHandler.types";

/**
 * Обработчик отображения sidebar'а и его кнопки
 * Размещается поверх контента страницы через position: absolute
 */
export function SidebarHandler({
  isOpen,
  onClose,
  onToggle,
  isDesktop,
  sidebarWidth,
  topInset,
}: SidebarHandlerProps) {
  const t = useT();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      }}
    >
      <ChatSidebar
        isOpen={isOpen}
        onClose={onClose}
        isDesktop={isDesktop}
        sidebarWidth={sidebarWidth}
      />

      {/* Кнопка открытия/закрытия панели */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 16,
          top: topInset + 12,
          zIndex: 60,
        }}
      >
        <ChatSidebarTrigger isOpen={isOpen} onPress={onToggle} />
      </View>

      {/* Кнопка временного чата: зеркально триггеру справа.
          zIndex ниже затемнения (40) — при открытой панели тап
          попадает в бэкдроп и просто закрывает панель */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 16,
          top: topInset + 12,
          zIndex: 30,
        }}
      >
        <TempChatButton onCloseSidebar={isDesktop ? undefined : onClose} />
      </View>

      {/* Заголовок "Chats" - показывается только когда sidebar открыт */}
      {isOpen && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            width: sidebarWidth,
            top: topInset + 12,
            height: 30,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 55,
          }}
        >
          <Text className="text-base font-semibold text-text-primary">
            {t("chats.title")}
          </Text>
        </View>
      )}
    </View>
  );
}
