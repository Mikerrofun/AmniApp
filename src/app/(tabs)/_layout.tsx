import { Tabs, usePathname } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ChatSidebarLayer } from '@/shared/components/layout/ChatSidebar';
import NavSwitch from '@/shared/components/layout/NavSwitch/NavSwitch';

export default function TabsLayout() {
  const pathname = usePathname();
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/');

  // Высота нижней навигации — чтобы сайдбар не заходил на неё
  const [navHeight, setNavHeight] = useState(0);

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <View
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height;
              setNavHeight((prev) => (prev === height ? prev : height));
            }}
          >
            <NavSwitch {...props} />
          </View>
        )}
      >
        <Tabs.Screen name="chat" options={{ title: 'Чат' }} />
        <Tabs.Screen name="api" options={{ title: 'API' }} />
        <Tabs.Screen name="check" options={{ title: 'FastCheck' }} />
      </Tabs>

      {/* Сайдбар рендерится после Tabs — поэтому перекрывает контент страницы */}
      {isChatRoute && <ChatSidebarLayer navHeight={navHeight} />}
    </View>
  );
}
