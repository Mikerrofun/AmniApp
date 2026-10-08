import { Text, View } from 'react-native';

export default function CheckScreen() {
  return (
    <View className="flex-1 bg-background">
      <Text className="pt-16 text-center text-2xl text-text-primary">
        FastCheck
      </Text>
      <Text className="pt-2 text-center text-sm text-text-muted">
        Быстрая проверка
      </Text>
    </View>
  );
}
