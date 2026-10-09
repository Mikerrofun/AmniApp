import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatSidebar } from './ChatSidebar.hooks';
import { ChatSidebar } from './ChatSidebar';
import { ChatSidebarTrigger } from './ChatSidebarTrigger';

type ChatSidebarLayerProps = {
  /** Высота нижней навигации: слой заканчивается ровно над ней */
  bottomOffset?: number;
};

/**
 * Слой сайдбара поверх контента страницы.
 * Должен монтироваться последним элементом в (tabs)/_layout.tsx —
 * изнутри экрана панели нельзя поднять выше таб-бара.
 */
export function ChatSidebarLayer({ bottomOffset = 0 }: ChatSidebarLayerProps) {
  const insets = useSafeAreaInsets();
  const sidebar = useChatSidebar();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: bottomOffset,
        left: 0,
      }}
    >
      <ChatSidebar
        isOpen={sidebar.isOpen}
        onClose={sidebar.close}
        isDesktop={sidebar.isDesktop}
        sidebarWidth={sidebar.sidebarWidth}
      />

      {/* Единая кнопка поверх панели: квадрат открывает и закрывает */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 16,
          top: insets.top + 12,
          zIndex: 60,
        }}
      >
        <ChatSidebarTrigger isOpen={sidebar.isOpen} onPress={sidebar.toggle} />
      </View>
    </View>
  );
}
