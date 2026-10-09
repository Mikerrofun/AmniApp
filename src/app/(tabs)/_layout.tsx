import { Tabs, usePathname } from 'expo-router';
import { View } from 'react-native';

import { ChatSidebarLayer } from '@/shared/components/layout/ChatSidebar';
import NavSwitch from '@/shared/components/layout/NavSwitch/NavSwitch';

export default function TabsLayout() {
  const pathname = usePathname();
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/');

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <NavSwitch {...props} />}
      >
        <Tabs.Screen name="chat" options={{ title: 'Чат' }} />
        <Tabs.Screen name="api" options={{ title: 'API' }} />
        <Tabs.Screen name="check" options={{ title: 'FastCheck' }} />
      </Tabs>

      {/* Сайдбар рендерится после Tabs — поэтому перекрывает и нижнюю навигацию */}
      {isChatRoute && <ChatSidebarLayer />}
    </View>
  );
}
