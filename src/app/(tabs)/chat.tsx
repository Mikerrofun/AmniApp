import { Text, View } from 'react-native';

export default function ChatScreen() {
  return (
    <View className="flex-1 bg-background">
      <Text className="pt-16 text-center text-2xl text-text-primary">Чат</Text>
      <Text className="pt-2 text-center text-sm text-text-muted">
        Общение с ассистентом
      </Text>
    </View>
  );
}
