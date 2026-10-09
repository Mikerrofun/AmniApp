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

  // На десктопе при открытой панели кнопка вызова не нужна
  const showTrigger = !sidebar.isDesktop || !sidebar.isOpen;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 flex-row">
        <ChatSidebar
          isOpen={sidebar.isOpen}
          onClose={sidebar.close}
          isDesktop={sidebar.isDesktop}
          sidebarWidth={sidebar.sidebarWidth}
        />

        <View className="flex-1" style={{ paddingTop: insets.top }}>
          {showTrigger && (
            <View className="px-4 pt-3">
              <ChatSidebarTrigger onPress={sidebar.open} />
            </View>
          )}
          <Text className="pt-16 text-center text-2xl text-text-primary">Чат</Text>
          <Text className="pt-2 text-center text-sm text-text-muted">
            Общение с ассистентом
          </Text>
        </View>
      </View>
    </View>
  );
}
