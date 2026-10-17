import { useT } from "@/shared/i18n";
import { useRef } from "react";
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useCreateShablon } from "../CreateShablonArea/CreateShablon.hooks";

export function CreateShablon() {
  const t = useT();
  const inputRef = useRef<View>(null);
  const { handleChange, Data } = useCreateShablon();
  const handleAdd = () => {};
  const handleClear = () => {};

  return (
    <View className="flex-1">
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 16,
        }}
        className="bg-gray-100"
      >
        <View className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md mx-auto">
          {/* Поле Title */}
          <View className="mb-4">
            <Text className="text-gray-700 font-semibold uppercase text-xs tracking-wider mb-2">
              Title
            </Text>
            <TextInput
              className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-base text-gray-800"
              placeholder="Введите название (title)..."
              placeholderTextColor="#9ca3af"
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
              value={Data.title}
              onChangeText={(text) => handleChange("title", text)}
            />
          </View>

          {/* Поле API */}
          <View className="mb-4">
            <Text className="text-gray-700 font-semibold uppercase text-xs tracking-wider mb-2">
              API
            </Text>
            <TextInput
              className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-base text-gray-800"
              placeholder="Введите данные API..."
              placeholderTextColor="#9ca3af"
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
              value={Data.api}
              onChangeText={(text) => handleChange("api", text)}
            />
          </View>

          {/* Поле Model */}
          <View className="mb-6">
            <Text className="text-gray-700 font-semibold uppercase text-xs tracking-wider mb-2">
              Model
            </Text>
            <TextInput
              className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-base text-gray-800"
              placeholder="Введите параметры модели (model)..."
              placeholderTextColor="#9ca3af"
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
              value={Data.model}
              onChangeText={(text) => handleChange("model", text)}
            />
          </View>

          <View className="flex-row gap-4">
            <TouchableOpacity
              className="flex-1 bg-green-500 py-3 rounded-lg active:bg-green-600 items-center justify-center"
              onPress={handleAdd}
            >
              <Text className="text-white font-bold text-base">Добавить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-red-500 py-3 rounded-lg active:bg-red-600 items-center justify-center"
              onPress={handleClear}
            >
              <Text className="text-white font-bold text-base">Стереть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
