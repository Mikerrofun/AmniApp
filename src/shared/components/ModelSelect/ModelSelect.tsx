import { ChevronDown } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import { FIELD_CLASS, MODEL_LIST_MAX_HEIGHT } from "./ModelSelect.config";
import type { ModelSelectProps } from "./ModelSelect.types";
import { useModelSelect } from "./useModelSelect";

/**
 * Переиспользуемый выбор модели. Единственный источник модели — список
 * провайдера: пока ключ не введен, поле заблокировано с подсказкой;
 * после загрузки списка — дропдаун с поиском. Ручной ввод имени разрешен
 * только при ошибке запроса или пустом списке — иначе модель не выбрать.
 */
export function ModelSelect({
  provider,
  apiKey,
  value,
  onChange,
  disabled = false,
}: ModelSelectProps) {
  const t = useT();
  const {
    isOpen,
    query,
    setQuery,
    status,
    hasList,
    filtered,
    isDropdownLocked,
    openDropdown,
    closeDropdown,
  } = useModelSelect({ provider, apiKey, disabled });

  // Список запрашивается: поле показывает состояние, выбор пока недоступен
  if (status === "loading") {
    return (
      <View className={`flex-row items-center gap-2 ${FIELD_CLASS}`}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text className="text-sm text-text-muted">
          {t("modelSelect.loading")}
        </Text>
      </View>
    );
  }

  // Ключа еще нет — список неоткуда запросить: ввод заблокирован,
  // вместо модели подсказка «вставьте ключ»
  if (status === "idle") {
    return (
      <TextInput
        value={value}
        editable={false}
        placeholder={t("modelSelect.insertKeyHint")}
        placeholderTextColor={colors.placeholder}
        className={`${FIELD_CLASS} opacity-50`}
      />
    );
  }

  // Ошибка запроса или провайдер отдал пустой список — ручной ввод имени
  if (!hasList) {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
        placeholder={t("apiTab.modelPlaceholder")}
        placeholderTextColor={colors.placeholder}
        className={FIELD_CLASS}
      />
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("apiTab.model")}
        accessibilityState={{ selected: value !== "" }}
        onPress={openDropdown}
        className={`flex-row items-center justify-between ${FIELD_CLASS} ${
          isDropdownLocked ? "opacity-50" : ""
        }`}
      >
        <Text
          className={`text-sm ${
            value ? "text-text-primary" : "text-text-muted"
          }`}
          numberOfLines={1}
        >
          {value || t("apiTab.modelPlaceholder")}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={isOpen}
        onRequestClose={closeDropdown}
      >
        <Pressable
          accessibilityLabel={t("modelSelect.close")}
          className="flex-1 bg-black/50 px-4 pt-24"
          onPress={closeDropdown}
        >
          <Pressable className="rounded-2xl border border-white/10 bg-card p-3">
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("modelSelect.searchPlaceholder")}
              placeholderTextColor={colors.placeholder}
              className={FIELD_CLASS}
            />

            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              style={{ maxHeight: MODEL_LIST_MAX_HEIGHT }}
              className="mt-2"
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isActive = item === value;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item}
                    accessibilityState={{ selected: isActive }}
                    onPress={() => {
                      onChange(item);
                      closeDropdown();
                    }}
                    className={`rounded-xl px-3 py-2.5 ${
                      isActive ? "bg-accent" : "active:bg-white/10"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        isActive
                          ? "font-semibold text-white"
                          : "text-text-primary"
                      }`}
                      numberOfLines={1}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text className="px-3 py-4 text-center text-sm text-text-muted">
                  {t("modelSelect.notFound")}
                </Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
