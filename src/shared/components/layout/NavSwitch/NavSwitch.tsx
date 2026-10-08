import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwitchGlobal } from '@/shared/components/ui/SwitchGlobal';
import { cn } from '@/shared/lib/cn';

const navLinks = [
  { key: 'chat', label: 'Чат', href: '/chat' },
  { key: 'api', label: 'API', href: '/api' },
  { key: 'check', label: 'FastCheck', href: '/check' },
] as const;

export default function NavSwitch({ state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const currentRouteName = state.routes[state.index]?.name;
  const currentKey =
    navLinks.find((link) => link.key === currentRouteName)?.key ?? navLinks[0].key;

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className="w-full rounded-t-lg border-t border-white/5 bg-card"
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
            <Text
              className={cn(
                'py-3 text-base',
                link.key === currentKey ? 'text-text-primary' : 'text-text-muted',
              )}
            >
              {link.label}
            </Text>
          ),
        }))}
        className="w-full bg-card p-2"
        sliderClassName="bg-accent"
      />
    </View>
  );
}
