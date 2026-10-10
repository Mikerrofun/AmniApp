import { Tabs } from "expo-router";

import { NavSwitch } from "@/features/navigation";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <NavSwitch {...props} />}
    >
      <Tabs.Screen name="chat" options={{ title: "Чат" }} />
      <Tabs.Screen name="api" options={{ title: "API" }} />
      <Tabs.Screen name="check" options={{ title: "FastCheck" }} />
    </Tabs>
  );
}
