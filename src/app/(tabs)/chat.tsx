import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatContent } from "./chat/components/ChatContent";
import { useChatSidebar } from "./chat/components/ChatSidebar";
import { SidebarHandler } from "./chat/components/SidebarHandler";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const sidebar = useChatSidebar();

  return (
    <View className="flex-1 bg-background">
      {/* Контент страницы */}
      <ChatContent topInset={insets.top} />

      {/* Sidebar поверх контента */}
      <SidebarHandler
        isOpen={sidebar.isOpen}
        onClose={sidebar.close}
        onToggle={sidebar.toggle}
        isDesktop={sidebar.isDesktop}
        sidebarWidth={sidebar.sidebarWidth}
        topInset={insets.top}
      />
    </View>
  );
}
