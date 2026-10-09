import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChatSidebar,
  ChatSidebarTrigger,
  useChatSidebar,
} from '@/shared/components/layout/ChatSidebar';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const sidebar = useChatSidebar();

  return (
    <View className="flex-1 bg-background">
      {/* Контент страницы — никогда не сдвигается, панель открывается поверх */}
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <Text className="pt-16 text-center text-2xl text-text-primary">Чат</Text>
        <Text className="pt-2 text-center text-sm text-text-muted">
          Общение с ассистентом
        </Text>
      </View>

      <ChatSidebar
        isOpen={sidebar.isOpen}
        onClose={sidebar.close}
        isDesktop={sidebar.isDesktop}
        sidebarWidth={sidebar.sidebarWidth}
      />

      {/* Единая кнопка поверх всего: квадрат открывает, крестик закрывает */}
      <View
        pointerEvents="box-none"
        className="absolute"
        style={{ left: 16, top: insets.top + 12, zIndex: 60 }}
      >
        <ChatSidebarTrigger isOpen={sidebar.isOpen} onPress={sidebar.toggle} />
      </View>
    </View>
  );
}
