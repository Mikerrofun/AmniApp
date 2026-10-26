import { ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";
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
import { modelsCacheKey, useModelsStore } from "@/shared/lib/ai/models-store";

import { MODEL_LIST_MAX_HEIGHT } from "./ModelSelect.config";
import type { ModelSelectProps } from "./ModelSelect.types";
import { filterModels } from "./filter-models";

const FIELD_CLASS =
  "rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary";

const EMPTY_MODELS: string[] = [];

export function ModelSelect({
  provider,
  apiKey,
  value,
  onChange,
  disabled = false,
}: ModelSelectProps) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const cacheKey = modelsCacheKey(provider, apiKey);
  const entry = useModelsStore((state) => state.entries[cacheKey]);
  const status = entry?.status ?? "idle";
  const models = entry?.models ?? EMPTY_MODELS;

  const hasList = status === "ready" && models.length > 0;
  const filtered = useMemo(() => filterModels(models, query), [models, query]);

  if (!hasList && status === "loading") {
    return (
      <View className={`flex-row items-center gap-2 ${FIELD_CLASS}`}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text className="text-sm text-text-muted">
          {t("modelSelect.loading")}
        </Text>
      </View>
    );
  }

  // Ошибка/пустой список/еще не запрашивался — ручной ввод имени модели
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

  const isDropdownLocked = disabled || apiKey.trim() === "";

  const openDropdown = () => {
    if (isDropdownLocked) return;

    setQuery("");
    setIsOpen(true);
  };

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
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          accessibilityLabel={t("modelSelect.close")}
          className="flex-1 bg-black/50 px-4 pt-24"
          onPress={() => setIsOpen(false)}
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
              className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary"
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
                      setIsOpen(false);
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
