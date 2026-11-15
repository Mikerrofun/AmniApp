import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { ModelSelect } from "@/shared/components/ModelSelect";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import { API_TAB_ANIMATION } from "../api-tab.animation";
import { useTemplateForm } from "./useTemplateForm";

export function TemplateForm() {
  const t = useT();
  const {
    name,
    setName,
    model,
    setModel,
    apiKey,
    setApiKey,
    providerLabel,
    resolvedBaseUrl,
    isManual,
    manualBaseUrl,
    setManualBaseUrl,
    baseUrlReady,
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
  const buttonStyle = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(
        canSubmit ? colors.accent : colors.background,
        {
          duration: API_TAB_ANIMATION.formFadeOut,
        },
      ),
    }),
    [canSubmit],
  );

  const buttonTextStyle = useAnimatedStyle(
    () => ({
      color: withTiming(canSubmit ? "#FFFFFF" : "#A0A0A0", {
        duration: API_TAB_ANIMATION.formFadeOut,
      }),
    }),
    [canSubmit],
  );

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

        {providerLabel && (
          <Animated.View
            entering={FadeInUp.duration(API_TAB_ANIMATION.listEnter)}
            exiting={FadeOut.duration(API_TAB_ANIMATION.listExit)}
          >
            <Text className="pt-4 text-sm text-text-primary">
              {providerLabel}
            </Text>
          </Animated.View>
        )}

        {/* Ручной ввод baseUrl появляется, только когда провайдер по ключу
            не определен; вход/выход — теми же анимациями, что у списка */}
        {isManual && (
          <Animated.View
            entering={FadeInUp.duration(API_TAB_ANIMATION.listEnter)}
            exiting={FadeOut.duration(API_TAB_ANIMATION.listExit)}
          >
            <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
              {t("apiTab.baseUrl")}
            </Text>
            <TextInput
              value={manualBaseUrl}
              onChangeText={setManualBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={t("apiTab.baseUrlPlaceholder")}
              placeholderTextColor={colors.placeholder}
              className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary"
            />
          </Animated.View>
        )}

        <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
          {t("apiTab.model")}
        </Text>
        <ModelSelect
          baseUrl={resolvedBaseUrl}
          apiKey={apiKey}
          value={model}
          onChange={setModel}
          disabled={!baseUrlReady}
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
          <Animated.Text
            style={buttonTextStyle}
            className="text-sm font-semibold"
          >
            {t("apiTab.add")}
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
