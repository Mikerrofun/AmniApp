import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SwitchGlobal } from "@/shared/components/ui/SwitchGlobal";
import { SwitcherButtonText } from "@/shared/components/ui/SwitcherButton";

import { navLinks } from "./NavSwitch.types";

export default function NavSwitch({ state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const currentRouteName = state.routes[state.index]?.name;
  const currentKey =
    navLinks.find((link) => link.key === currentRouteName)?.key ??
    navLinks[0].key;

  return (
    <View
      style={{ paddingBottom: insets.bottom, marginBottom: 10 }}
      className="w-full rounded-[20px] border-t border-white/5 bg-card"
    >
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
        className="w-full bg-card"
        sliderClassName="bg-accent"
      />
    </View>
  );
}
