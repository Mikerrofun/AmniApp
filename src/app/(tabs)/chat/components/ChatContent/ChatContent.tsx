import { Text, View } from "react-native";

import type { ChatContentProps } from "./ChatContent.types";

export function ChatContent({ topInset }: ChatContentProps) {
  return (
    <View className="flex-1" style={{ paddingTop: topInset }}>
      <Text className="pt-16 text-center text-2xl text-text-primary">Чат</Text>
      <Text className="pt-2 text-center text-sm text-text-muted">
        Общение с ассистентом
      </Text>
    </View>
  );
}
