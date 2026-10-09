import { useState } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { View } from 'react-native';

import { ChatSidebarLayer } from '@/shared/components/layout/ChatSidebar';
import NavSwitch from '@/shared/components/layout/NavSwitch/NavSwitch';

export default function TabsLayout() {
  const pathname = usePathname();
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/');
  const [navHeight, setNavHeight] = useState(0);

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <NavSwitch {...props} onLayout={setNavHeight} />}
      >
        <Tabs.Screen name="chat" options={{ title: 'Чат' }} />
        <Tabs.Screen name="api" options={{ title: 'API' }} />
        <Tabs.Screen name="check" options={{ title: 'FastCheck' }} />
      </Tabs>

      {/* Сайдбар рендерится после Tabs — поэтому перекрывает контент страницы,
          но заканчивается ровно на верхней границе навигации */}
      {isChatRoute && <ChatSidebarLayer bottomOffset={navHeight} />}
    </View>
  );
}
