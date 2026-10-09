import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      {/* Контент страницы — никогда не сдвигается, панель открывается поверх */}
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        <Text className="pt-16 text-center text-2xl text-text-primary">Чат</Text>
        <Text className="pt-2 text-center text-sm text-text-muted">
          Общение с ассистентом
        </Text>
      </View>
    </View>
  );
}
