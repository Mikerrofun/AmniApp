import { Text, View } from "react-native";
import { CreateShablon } from "./api/components/CreateShablonArea/CreateShablon";

export default function ApiScreen() {
  return (
    <View className="flex-1 bg-background">
      <Text className="pt-16 text-center text-2xl text-text-primary">API</Text>
      <Text className="pt-2 text-center text-sm text-text-muted">
        Шаблоны-API
      </Text>
      <CreateShablon />
    </View>
  );
}
