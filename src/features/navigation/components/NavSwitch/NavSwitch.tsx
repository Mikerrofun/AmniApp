import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SwitchGlobal } from "@/shared/components/ui/SwitchGlobal";
import { SwitcherButtonText } from "@/shared/components/ui/SwitcherButton";

import { navLinks } from "./NavSwitch.config";

export default function NavSwitch({ state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const currentRouteName = state.routes[state.index]?.name;
  const currentKey =
    navLinks.find((link) => link.key === currentRouteName)?.key ??
    navLinks[0].key;

  return (
    // Плавающая панель: боковые отступы не дают ей доходить до краев
    // экрана (скругленные углы телефона не срезают панель), снизу —
    // отступ по safe area (минимум 8px на устройствах без жестовой
    // навигации)
    <View
      className="w-full px-3"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      <View className="w-full overflow-hidden rounded-[20px] border border-white/5 bg-card">
        <SwitchGlobal
          equalWidth
          value={currentKey}
          onChange={(key) => {
            const link = navLinks.find((item) => item.key === key);
            if (link) router.navigate(link.href);
          }}
          options={navLinks.map((link) => ({
            key: link.key,
            component: (
              <SwitcherButtonText
                label={link.label}
                isActive={link.key === currentKey}
              />
            ),
          }))}
          className="w-full"
          sliderClassName="bg-accent"
        />
      </View>
    </View>
  );
}
