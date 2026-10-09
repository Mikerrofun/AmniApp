import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatSidebar } from './ChatSidebar.hooks';
import { ChatSidebar } from './ChatSidebar';
import { ChatSidebarTrigger } from './ChatSidebarTrigger';
import type { ChatSidebarLayerProps } from './ChatSidebar.types';

/** Нижний отступ самой навигации (marginBottom в NavSwitch) */
const NAV_BOTTOM_MARGIN = 10;

/**
 * Слой сайдбара поверх контента страницы, но не выше нижней навигации:
 * панель и затемнение останавливаются над nav с зазором 10px.
 * Должен монтироваться последним элементом в (tabs)/_layout.tsx —
 * изнутри экрана панели нельзя поднять выше таб-бара.
 */
export function ChatSidebarLayer({ navHeight }: ChatSidebarLayerProps) {
  const insets = useSafeAreaInsets();
  const sidebar = useChatSidebar();

  const navTopOffset = navHeight + NAV_BOTTOM_MARGIN;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <ChatSidebar
        isOpen={sidebar.isOpen}
        onClose={sidebar.close}
        isDesktop={sidebar.isDesktop}
        sidebarWidth={sidebar.sidebarWidth}
        navTopOffset={navTopOffset}
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
