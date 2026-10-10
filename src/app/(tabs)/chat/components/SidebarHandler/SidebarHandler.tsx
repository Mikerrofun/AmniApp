import { View } from "react-native";

import { ChatSidebar } from "../ChatSidebar";
import { ChatSidebarTrigger } from "../ChatSidebar";

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
    </View>
  );
}
