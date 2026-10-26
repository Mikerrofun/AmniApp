import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { ModelSelect } from "@/shared/components/ModelSelect";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";
import { API_TEMPLATE_PRESETS } from "@/types/api-template";

import { API_TAB_ANIMATION } from "../api-tab.animation";
import { useTemplateForm } from "./useTemplateForm";

export function TemplateForm() {
  const t = useT();
  const {
    name,
    setName,
    provider,
    setProvider,
    model,
    setModel,
    apiKey,
    setApiKey,
    isClearing,
    canSubmit,
    handleAdd,
  } = useTemplateForm();

  // Очистка после добавления: поля гаснут, очищаются невидимыми и возвращаются
  const fieldsStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(
        isClearing ? 0 : 1,
        isClearing
          ? { duration: API_TAB_ANIMATION.formFadeOut }
          : { duration: API_TAB_ANIMATION.formFadeIn },
      ),
    }),
    [isClearing],
  );

  // Кнопка: серая, пока форма не заполнена, красная — когда заполнена
  const buttonStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      canSubmit ? colors.accent : colors.card,
      { duration: API_TAB_ANIMATION.formFadeOut },
    ),
  }), [canSubmit]);

  const buttonTextStyle = useAnimatedStyle(() => ({
    color: withTiming(
      canSubmit ? "#FFFFFF" : colors.textMuted,
      { duration: API_TAB_ANIMATION.formFadeOut },
    ),
  }), [canSubmit]);

  return (
    <View className="mx-4 mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      <Animated.View style={fieldsStyle}>
        <Text className="pb-1 text-xs uppercase tracking-wide text-text-muted">
          {t("apiTab.name")}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("apiTab.namePlaceholder")}
          placeholderTextColor={colors.placeholder}
          className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary"
        />

        <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
          {t("apiTab.provider")}
        </Text>
        <View className="flex-row gap-2">
          {Object.values(API_TEMPLATE_PRESETS).map((preset) => {
            const isActive = preset.id === provider;

            return (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={preset.label}
                accessibilityState={{ selected: isActive }}
                onPress={() => setProvider(preset.id)}
                className={`flex-1 items-center rounded-xl border py-2 ${
                  isActive
                    ? "border-accent bg-accent"
                    : "border-white/10 bg-background"
                }`}
              >
                <Text
                  className={`text-sm ${
                    isActive ? "font-semibold text-white" : "text-text-primary"
                  }`}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
          {t("apiTab.model")}
        </Text>
        <ModelSelect
          baseUrl={API_TEMPLATE_PRESETS[provider].baseUrl}
          provider={provider}
          apiKey={apiKey}
          value={model}
          onChange={setModel}
        />

        <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
          {t("apiTab.apiKey")}
        </Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder={t("apiTab.apiKeyPlaceholder")}
          placeholderTextColor={colors.placeholder}
          className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary"
        />
      </Animated.View>

      <Animated.View style={buttonStyle} className="mt-4 rounded-xl">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("apiTab.add")}
          accessibilityState={{ disabled: !canSubmit || isClearing }}
          disabled={!canSubmit || isClearing}
          onPress={() => void handleAdd()}
          className="items-center py-2.5"
        >
          <Animated.Text style={buttonTextStyle} className="text-sm font-semibold">
            {t("apiTab.add")}
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
