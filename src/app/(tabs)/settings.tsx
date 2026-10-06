import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-white p-4 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Settings' }} />
      <Text className="text-neutral-500 dark:text-neutral-400">
        Provider, API key, model and temperature settings will live here.
      </Text>
    </View>
  );
}
