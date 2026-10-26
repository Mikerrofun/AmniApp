import { ChevronDown } from "lucide-react-native";
import { useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  PopoverMenu,
  type PopoverAnchor,
} from "@/shared/components/ui/PopoverMenu";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import { FIELD_CLASS, MODEL_LIST_MAX_HEIGHT } from "./ModelSelect.config";
import type { ModelSelectProps } from "./ModelSelect.types";
import { useModelSelect } from "./useModelSelect";

const FALLBACK_POPOVER_WIDTH = 280;

export function ModelSelect({
  provider,
  apiKey,
  value,
  onChange,
  disabled = false,
}: ModelSelectProps) {
  const t = useT();
  const triggerRef = useRef<ComponentRef<typeof Pressable> | null>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);

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

  const handleOpen = () => {
    if (isDropdownLocked) return;

    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      openDropdown();
    });
  };

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
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={t("apiTab.model")}
        accessibilityState={{ selected: value !== "", expanded: isOpen }}
        onPress={handleOpen}
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

      <PopoverMenu
        open={isOpen}
        onClose={closeDropdown}
        anchor={anchor}
        placement="bottom-start"
        width={anchor?.width ?? FALLBACK_POPOVER_WIDTH}
        maxHeight={MODEL_LIST_MAX_HEIGHT}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t("modelSelect.searchPlaceholder")}
          placeholderTextColor={colors.placeholder}
          className="mb-1 rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary"
        />

        {filtered.length === 0 ? (
          <Text className="px-3 py-4 text-center text-sm text-text-muted">
            {t("modelSelect.notFound")}
          </Text>
        ) : (
          filtered.map((item) => {
            const isActive = item === value;

            return (
              <Pressable
                key={item}
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
                    isActive ? "font-semibold text-white" : "text-text-primary"
                  }`}
                  numberOfLines={1}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })
        )}
      </PopoverMenu>
    </>
  );
}
